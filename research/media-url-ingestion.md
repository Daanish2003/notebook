# Media URL ingestion and synced playback

Research for `.scratch/notebook-v1/issues/02-media-url-ingestion.md`. It covers what `yt-dlp` gives us for a media URL, how ingestion fails, and what playback needs to highlight the active Segment.

Method: primary sources (the yt-dlp README, wiki, and installed source code; Google's IFrame Player API docs; WebKit and caniuse data), plus experiments run on 2026-11-22 on the Omarchy machine (`yt-dlp 2026.08.19`, `ffmpeg n9.0.2`, `deno 2.9.8`, Chrome). Downloads went to a `mktemp -d` directory that was deleted afterwards. The test video was `jNQXAC9IVRw` ("Me at the zoo", 19 s).

## 1. Audio-only download

| Command                                     | Result (measured)                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `yt-dlp -f bestaudio URL`                   | format `251`, Opus 48 kHz stereo in WebM, ~106 kbps, 246 KiB. No ffmpeg involved.                                  |
| `yt-dlp -x --audio-format opus URL`         | Same stream, remuxed WebM to Ogg with `ffmpeg -i a.webm -vn -acodec copy a.opus`. No re-encode.                    |
| `yt-dlp -x` (default `--audio-format best`) | Keeps the file as-is if it is already a common audio format, otherwise copies the codec into its native container. |

- The re-encode decision lives in `FFmpegExtractAudioPP.run` (`yt_dlp/postprocessor/ffmpeg.py`). With `best`, or with a target equal to the source codec, it uses `acodec = 'copy'`, which is "Lossless if possible". It re-encodes only when the target codec differs, for example `--audio-format mp3` on an Opus source. Seen in `-v` output: `ffmpeg command line: ffmpeg -y ... -i file:a4.webm -vn -acodec copy -movflags +faststart file:a4.opus`.
- YouTube audio formats offered for the test video: `249`, `250`, `251` (Opus, 48 kHz, ~50/60/106 kbps), `139`, `140` (AAC m4a), and `-drc` variants of each (dynamic-range-compressed). Plain `bestaudio` picked `251`, not a DRC variant.
- Other sites differ. SoundCloud (`soundcloud.com/forss/flickermood`) offers only `hls_aac_96k` and `hls_aac_160k` (AAC m4a over HLS). So `-x --audio-format opus` would **re-encode** there. Use `-x` with the default `best` to keep the original codec, and treat "Opus" as YouTube-specific.
- The README describes `-x` as "Convert video files to audio-only files" (needs ffmpeg and ffprobe), with `--audio-format` defaulting to `best`. https://github.com/yt-dlp/yt-dlp#post-processing-options
- **Full YouTube support needs a JS runtime.** The README lists `yt-dlp-ejs` as "Required for full YouTube support", run by a JavaScript runtime with deno recommended. The Arch package depends on `yt-dlp-ejs`, and `/usr/bin/deno` is present. Debug output shows `JS runtimes: deno-2.9.8` and `[jsc:deno] Solving JS challenges using deno`. Without one, YouTube formats degrade or vanish. https://github.com/yt-dlp/yt-dlp#dependencies

Recommended worker invocation (one call, no separate metadata pass):

```sh
yt-dlp --no-playlist --no-update -f bestaudio/best -x \
  --match-filters "live_status!=is_live & live_status!=is_upcoming" \
  --write-info-json --print after_move:filepath \
  -o "$MEDIA_DIR/<id>/source.%(ext)s" URL
```

`--print after_move:filepath` prints the final path (verified: `/tmp/.../a3.webm`). `--print` implies quiet mode, so progress lines disappear. Use `--progress --newline` (or `--progress-template`) if the worker wants to record `progress`.

## 2. Metadata (`--dump-json` / `-J`, or `--print '%(field)s'`)

These field names and values are real, from `yt-dlp --dump-json --no-download` on `jNQXAC9IVRw`:

| Need             | Field                                                                      | Value                                                                               |
| ---------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Title            | `title` (also `fulltitle`)                                                 | `"Me at the zoo"`                                                                   |
| Channel          | `channel`, `channel_id`, `channel_url`                                     | `"jawed"`, `"UC4QobU6STFB0P71PMvOGN5A"`, `https://www.youtube.com/channel/UC4Q…`    |
| Uploader         | `uploader`, `uploader_id`, `uploader_url`                                  | `"jawed"`, `"@jawed"`                                                               |
| Thumbnail        | `thumbnail` (best), `thumbnails[]` (44 entries)                            | `https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg?...`                              |
| Duration         | `duration` (seconds, number), `duration_string`                            | `19`, `"19"`                                                                        |
| Upload date      | `upload_date` (`YYYYMMDD` string), `timestamp` (unix), `release_timestamp` | `"20050424"`, `1114313512`, `null`                                                  |
| Chapters         | `chapters[]` of `{start_time, end_time, title}`                            | `[{start_time:0,end_time:5,title:"Intro"}, {5,17,"The cool thing"}, {17,19,"End"}]` |
| Manual subtitles | `subtitles{lang: [{ext,url,...}]}`                                         | `en`, `de`, each in `json3, srv1, srv2, srv3, ttml, srt, vtt`                       |
| Auto-captions    | `automatic_captions{lang: [...]}`                                          | `en`, `de` (`vtt`)                                                                  |
| Live state       | `live_status`, `is_live`, `was_live`                                       | `"not_live"`, `false`, `false`                                                      |
| Access           | `availability`, `age_limit`                                                | `"public"`, `0`                                                                     |
| Embeddable       | `playable_in_embed`                                                        | `true`                                                                              |
| Identity         | `id`, `extractor` / `extractor_key`, `webpage_url`, `media_type`           | `"jNQXAC9IVRw"`, `"youtube"`, …, `"video"`                                          |
| Language         | `language`                                                                 | `null` (often missing)                                                              |

Also present: `description`, `tags`, `categories`, `view_count`, `like_count`, `comment_count`, `heatmap`, `channel_follower_count`, `formats[]`.

- README definitions: `live_status` is "One of "not_live", "is_live", "is_upcoming", "was_live", "post_live"". `availability` is "Whether the video is "private", "premium_only", "subscriber_only", "needs_auth", "unlisted" or "public"". `playable_in_embed` is "Whether this video is allowed to play in embedded players on other sites". https://github.com/yt-dlp/yt-dlp#output-template
- Fields are extractor-dependent. SoundCloud returned `title`, `uploader`, `duration: 213.886` (a float), `upload_date`, `thumbnail`, and `channel: null`, `chapters: null`. Store everything as nullable and fall back from `channel` to `uploader`.
- Subtitles can be fetched without the media: `--skip-download --write-subs --write-auto-subs --sub-langs en --sub-format vtt` wrote `s.en.vtt` (manual captions, cue times like `00:00:01.200 --> 00:00:03.360`).
- `--write-info-json` saves the whole dict next to the audio, so fields can be re-derived later without hitting the network.

## 3. Failure modes and how they surface

Exit codes, from the installed `yt_dlp/__init__.py`:

| Exit code | Meaning                                                                                                                                                                                  |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0`       | Success, including the case where a `--match-filters` rejection skipped the video.                                                                                                       |
| `1`       | Any `DownloadError` (extraction or download failure), `CookieLoadError`, and similar. Errors print to stderr as `ERROR: [extractor] <id>: <message>`.                                    |
| `2`       | Bad options (`OptParseError`), or no URL given.                                                                                                                                          |
| `101`     | `DownloadCancelled`: `--break-match-filters`, `--max-downloads`, or `--break-on-existing` triggered. Measured: `101` for a live URL with `--break-match-filters "live_status!=is_live"`. |

Since every real failure is exit 1, **classify failures by matching the `ERROR:` line on stderr**. Better still, call yt-dlp as a Python library from the worker (it is Python already) and catch `yt_dlp.utils.DownloadError`, `GeoRestrictedError`, and similar.

| Case                                     | How it surfaced (measured unless marked)                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nonexistent or removed                   | exit 1, `ERROR: [youtube] aaaaaaaaaaa: This video is unavailable`                                                                                                                                                                                                                                                                                                                                      |
| Private                                  | exit 1, `ERROR: [youtube] yZIXLfi8CZQ: Private video`                                                                                                                                                                                                                                                                                                                                                  |
| Age-restricted (`HtVdAasjOgU`)           | **Downloaded fine, exit 0**, through the "web embedded" client, with a warning: `This video is age-restricted; some formats may be missing without authentication. Use --cookies-from-browser or --cookies…`. Metadata shows `availability=needs_auth`, `age_limit=18`. Age-restricted videos that are not embeddable need cookies (wiki).                                                             |
| Members-only                             | Not testable without a membership. The wiki lists "private playlists, age-restricted videos and members-only content" as needing an account and cookies. `availability` would be `subscriber_only`.                                                                                                                                                                                                    |
| Live now (`@LofiGirl/live`)              | Extraction succeeds with `live_status=is_live`. A plain download would record the stream indefinitely. `--match-filters "live_status!=is_live"` skips it (exit 0, nothing downloaded). `--break-match-filters` exits 101.                                                                                                                                                                              |
| Live ended, no recording                 | exit 1, `ERROR: [youtube] jfKfPfyJRdk: This live stream recording is not available.`                                                                                                                                                                                                                                                                                                                   |
| Upcoming / premiere                      | Source code: no formats, so `raise_no_formats(reason)` with YouTube's own reason text (e.g. "This live event will begin in …"). exit 1. `live_status=is_upcoming` is readable with `--ignore-no-formats-error`. `--wait-for-video` exists but is not wanted here.                                                                                                                                      |
| Playlist URL (`/playlist?list=…`)        | Expands to every entry, and `--no-playlist` does **not** stop that. Hidden or private entries produce `ERROR: … Private video` lines and exit 1 even though other entries succeeded. Plus the warning `YouTube said: INFO - 3 unavailable videos are hidden`.                                                                                                                                          |
| Video in a playlist (`watch?v=…&list=…`) | With `--no-playlist`, only the video is processed (exit 0).                                                                                                                                                                                                                                                                                                                                            |
| Geo-blocked                              | Source: subreason "The uploader has not made this video available in your country" leads to `GeoRestrictedError`, "This video is not available from your location due to geo restriction". exit 1.                                                                                                                                                                                                     |
| Bot check                                | Source: a reason containing "sign in" (YouTube's "Sign in to confirm you're not a bot") gets the cookie hint appended. A `playerCaptchaViewModel` gives "…YouTube is requiring a captcha challenge before playback".                                                                                                                                                                                   |
| Rate limited                             | Source: "This content isn't available, try again later" is rewritten to "…has been rate-limited by YouTube for up to an hour. It is recommended to use `-t sleep`…". The wiki estimates ~300 videos/hour for guest sessions and ~2000/hour with an account, and advises 5–10 s between requests. yt-dlp already sleeps 5 s before some downloads (`Sleeping 5.00 seconds as required by the site...`). |
| PO tokens                                | Wiki: YouTube is "gradually enforcing the use of a "PO Token"", which yt-dlp cannot generate itself. This is the likely next breakage. https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide                                                                                                                                                                                                            |
| Unsupported site                         | exit 1, `ERROR: Unsupported URL: https://example.com/` (after `WARNING: [generic] Falling back on generic information extractor`)                                                                                                                                                                                                                                                                      |
| Site needs login                         | e.g. Vimeo: exit 1, `ERROR: [vimeo] 76979871: The web client only works when logged-in. Use --cookies, --cookies-from-browser, …`                                                                                                                                                                                                                                                                      |

Cookies: the wiki warns that using an account risks "it being banned". To export stable YouTube cookies, use a private window, log in, open `youtube.com/robots.txt` in a single tab, export, and close the window, because "YouTube rotates account cookies frequently on open YouTube browser tabs". The wiki advises against `--cookies-from-browser` for this. https://github.com/yt-dlp/yt-dlp/wiki/Extractors#youtube and https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp

## 4. Keeping yt-dlp current

- Installed: `yt-dlp 2026.08.19-1` from Arch `extra`, installed 2026-08-26. Every run prints `WARNING: Your yt-dlp version (2026.08.19) is older than 90 days! … You installed yt-dlp from a manual build or with a package manager; Use that to update.`
- Latest upstream release is `2026.10.26` (GitHub, 2026-10-26), and Arch `extra` already ships it (archlinux.org JSON, `last_update` 2026-10-27). The local pacman sync DB was just stale. **Fix: `sudo pacman -Syu`.** The wiki's Arch instruction is `sudo pacman -Syu yt-dlp`. https://github.com/yt-dlp/yt-dlp/wiki/Installation
- `yt-dlp -U` only works for release binaries. For pip installs, "re-run the same command that was used to install". https://github.com/yt-dlp/yt-dlp#update
- To decouple from the distro, use `uv` (already at `~/.local/bin/uv`; `pipx` is not installed). Either `uv tool install "yt-dlp[default]"`, then `uv tool upgrade yt-dlp`, or (better for us) declare `yt-dlp[default]` as a dependency of `apps/transcriber` and import it as a library, so `uv lock --upgrade-package yt-dlp` updates it with the worker. The `[default]` extra pulls in `yt-dlp-ejs` and friends. A JS runtime (deno) is still a system dependency. These uv commands come from uv's tool docs, not the yt-dlp wiki, which documents only pip (`python3 -m pip install -U "yt-dlp[default]"`, and `--pre` for nightly).
- The README recommends the `nightly` channel for regular users, since fixes for YouTube changes land there first.
- In the worker, pass `--no-update` (or `"no_update"` in library options) to suppress the warning noise, and track freshness separately, e.g. a weekly systemd timer that upgrades.

## 5. YouTube IFrame Player API (playback for YouTube Sources)

Docs: https://developers.google.com/youtube/iframe_api_reference and https://developers.google.com/youtube/player_parameters

**Reading time.** `getCurrentTime()` "Returns the elapsed time in seconds since the video started playing". It is a float. There is **no time-update event**: the events are `onReady`, `onStateChange`, `onPlaybackQualityChange`, `onPlaybackRateChange`, `onError`, `onApiChange`, and `onAutoplayBlocked`. So we poll.

- Measured (Chrome, real embed, polled every 20 ms for 3 s): 150 samples, **150 distinct values**, advancing ~0.020 s per poll (e.g. `1.9076, 1.9286, 1.9486, …`). The value is interpolated client-side, not stepped at 250 ms, so a `requestAnimationFrame` or 50–100 ms poll is sufficient and cheap (it is a synchronous read of cached state).
- Poll only while `getPlayerState() === 1` (playing), and start or stop the loop from `onStateChange` (`-1` unstarted, `0` ended, `1` playing, `2` paused, `3` buffering, `5` cued).

**Seeking.** Docs: `seekTo(seconds, allowSeekAhead)`. "If the player is paused when the function is called, it will remain paused". From other states it plays. It may snap to the previous keyframe unless that part is already buffered. Use `allowSeekAhead=false` while scrubbing and `true` on release. Measured:

- Seek while playing to 10.37: `getCurrentTime()` read **immediately after** still returned the old position (11.44), because the API is asynchronous via postMessage. 600 ms later it read 10.91 (10.37 plus elapsed play), with a `3 → 1` (buffering, then playing) state pair in between. **Don't trust `getCurrentTime()` right after `seekTo`.** Set the active Segment optimistically from the seek target.
- Seek while paused to 4.123: it stayed paused (`state 2`), fired no state change, and read exactly `4.123` after the round trip. So "click a Segment to jump there" works whether playing or paused.
- `setPlaybackRate(2)` took effect. `getAvailablePlaybackRates()` returned `[0.25 … 2]`.

**Constraints.**

- Embedding disabled: `onError` gives `101`, or `150` ("just a `101` error in disguise"). Other codes: `100` not found or private, `2` bad id, `5` HTML5 error, `153` request lacks `HTTP Referer` or client identification. We can know this at ingest: `playable_in_embed` from yt-dlp.
- Referer and origin: set `origin` (the page's scheme and host) and don't set `referrerpolicy="no-referrer"` on the iframe, or the player fails with 153. On the tailnet that means the `*.ts.net` HTTPS origin from `tailscale serve`.
- Size: "Embedded players must have a viewport that is at least 200px by 200px". 480×270 is recommended for 16:9, which matters for a compact reader layout.
- Mobile and autoplay: autoplay is governed by the browser. `onAutoplayBlocked` fires when unmuted playback without a user gesture is blocked. Start playback from a user tap. On iOS, pass `playsinline=1`, or playback goes fullscreen ("`0`: Results in fullscreen playback. This is currently the default value"). `enablejsapi=1` is required for API control.
- Our experiment loaded `https://www.youtube.com/iframe_api` from an `https://example.com` page and worked with no API key.

## 6. Non-YouTube sites: our own Opus copy in `<audio>`

Yes, serving the downloaded copy through `<audio>` is the right fallback. The same model also covers YouTube Sources that are not embeddable, and offline playback in the PWA. `HTMLMediaElement` gives a precise `currentTime`, sample-accurate `currentTime = x` seeks for local files, and a `timeupdate` event that fires "between about 4Hz and 66Hz" (MDN). Use rAF polling while playing for smooth highlighting. https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/timeupdate_event

The serving route must support HTTP `Range` requests (206), or Safari won't seek.

**Opus on iOS Safari** (caniuse data, `Fyrd/caniuse` `features-json/opus.json`; WebKit blog):

| iOS Safari   | Opus support                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11 – 17.3    | Partial: only "packaged in a CAF file … (constant bit-rate only)"                                                                                                                                  |
| 17.4         | WebM container, with a known regression (https://bugs.webkit.org/show_bug.cgi?id=245428)                                                                                                           |
| 17.5 – 18.3  | Opus in WebM, "all bitrates"                                                                                                                                                                       |
| **18.4+**    | Full support. WebKit 18.4 added "Ogg container support for both Opus and Vorbis audio on macOS Sequoia 15.4, iOS 18.4, iPadOS 18.4". https://webkit.org/blog/16574/webkit-features-in-safari-18-4/ |
| macOS Safari | Same, but Ogg only on macOS 15.4 Sequoia or later                                                                                                                                                  |

Container choice: **keep YouTube's WebM-Opus as-is** (what `-f bestaudio` gives, with no ffmpeg step). It plays on iOS 17.5+ and in every Chromium and Firefox. Remuxing to `.opus` (Ogg) narrows support to iOS/macOS 18.4 and Sequoia 15.4+. For uploads that we transcode ourselves, writing Opus in WebM (`ffmpeg -c:a libopus -f webm`) gets the same wider reach. Sources like SoundCloud arrive as AAC m4a, which plays everywhere. Keep it rather than re-encode.

## Implications for Notebook

1. **Use yt-dlp as a Python library in `apps/transcriber`**, pinned via `uv` as `yt-dlp[default]`. Failures become typed exceptions instead of stderr parsing (every CLI failure is exit 1), and upgrades become a `uv lock --upgrade-package yt-dlp` step that does not depend on Arch's package. Keep `deno` installed as a system dependency for YouTube's JS challenges. Until then, `sudo pacman -Syu` fixes the outdated warning today (2026.10.26 is in `extra`).
2. **One extraction pass** gives title (`title`), Source author (`channel`, falling back to `uploader`), `thumbnail`, `duration`, `upload_date`/`timestamp`, `chapters`, `subtitles`/`automatic_captions`, `live_status`, `availability` and `playable_in_embed`. Store `info.json` next to the audio. Columns should be nullable, because extractors vary.
3. **Download with `-f bestaudio/best -x` (default `best`), never `--audio-format opus`**: it is lossless for YouTube (WebM-Opus) and avoids re-encoding AAC-only sites. Keep the file as the playback copy, since it is already in a format iOS 17.5+ plays. Normalise to 16 kHz WAV separately, as `docs/transcription.md` already says.
4. **Reject before downloading**: `live_status` in `is_live`/`is_upcoming` gives a clear "live streams aren't supported" error. Playlist URLs (`/playlist?list=`) are rejected up front or the owner is asked, because `--no-playlist` does not stop them. Strip `list=` from watch URLs, or rely on `noplaylist`.
5. **Map failures to owner-readable `error` messages**: unavailable or private, geo-blocked, needs sign-in (age-restricted, members-only, bot check), rate-limited (retry later; the queue should back off about an hour), unsupported site. Cookies stay out of v1, except as an optional `cookies.txt` path in worker env, with the ban risk documented.
6. **Playback**: a YouTube Source with `playable_in_embed=true` uses the IFrame API with `enablejsapi=1`, `playsinline=1`, and `origin` set. Highlighting polls `getCurrentTime()` with rAF or ~100 ms while state is `1`, and is precise to well under a Segment. Click-to-seek uses `seekTo(t, true)`, with the active Segment set optimistically. Playback must start from a user tap.
7. **Fallback**: a non-YouTube Source, a non-embeddable video, or offline playback uses `<audio>` on our stored copy, served with Range support. That argues for always keeping the downloaded audio for URL Sources too, not only uploads, which revisits the "keep or remove the source" setting in `docs/transcription.md`. Minimum client: iOS 17.5 for WebM-Opus, 18.4 for Ogg.
8. **Existing captions** (`subtitles` and `automatic_captions`) are available cheaply, but they are not Segment-shaped. At most they are a future quality or alignment aid. Parakeet stays the source of the Transcript.
