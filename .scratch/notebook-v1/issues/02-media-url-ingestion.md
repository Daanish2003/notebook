# Media URL ingestion and synced playback

Type: research
Status: resolved
Blocked by:

## Question

For a media URL, what does `yt-dlp` give us and what does playback need? Cover: audio-only download flags, the metadata available (title, channel, thumbnail, duration, upload date, chapters, existing subtitles), failure modes (private, age-restricted, live, playlists, rate limits), and how YouTube's IFrame Player API exposes current time for highlighting the active Segment (how precise, how often, and does seeking work). For non-YouTube sites without an embeddable player, is playing our own downloaded Opus copy the right fallback?

## Answer

Research: [`research/media-url-ingestion.md` on branch `research/media-url-ingestion`](https://github.com/Daanish2003/notebook/blob/research/media-url-ingestion/research/media-url-ingestion.md)

- Use yt-dlp as a Python library, pinned with uv in `apps/transcriber`, so it can be kept current. YouTube needs a JS runtime (deno, installed).
- `-x` with the default `best` keeps YouTube's Opus/WebM (about 106 kbps) without re-encoding. Other sites deliver other codecs, such as AAC on SoundCloud.
- The metadata covers what the Library needs: `title`, `channel`, `thumbnail`, `duration`, `upload_date`, `chapters[]`, `subtitles`/`automatic_captions`, `live_status`, `playable_in_embed`. Every field can be null on non-YouTube sites.
- Every failure exits 1, so failures are told apart by error text: unavailable, private, unsupported URL, login-required, bot check/rate limit. Reject live streams with `live_status`, and detect playlist URLs ourselves (`--no-playlist` doesn't stop them).
- The YouTube IFrame API has no time event. Polling `getCurrentTime()` is smooth at 20 ms. Right after a seek it reports the old time, so set the active Segment from the seek target. Embeds need `playsinline=1`, a tap to start, and at least 200×200 px. Error 101/150 means embedding is disabled.
- Our own copy plays in `<audio>` from a server route that supports Range requests. Keep WebM/Opus as-is (iOS Safari 17.5+).
