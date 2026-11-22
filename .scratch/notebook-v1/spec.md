# Notebook v1 spec

Status: ready-for-agent

Synthesised from the wayfinder map (`.scratch/notebook-v1/map.md`) and its 17 resolved tickets. Vocabulary follows `GLOSSARY.md`; architecture follows `docs/adr/0001`–`0003` and `docs/transcription.md`. Each decision below cites its source ticket by name; the ticket holds the detail and the reasoning.

## Problem Statement

The Owner watches and listens to a lot of long-form media: lectures, talks, podcasts and their own recordings. Finding what was said, or going back to a moment, means scrubbing through video. Cloud transcription services cost money and send private recordings off the machine. The Owner already runs a capable GPU and a speech model (the Parakeet model voxtype uses) on their Omarchy desktop. But there's no way to turn an hour of media into readable, searchable text they can open from their phone or laptop, keep, and hand to their AI agents.

## Solution

Notebook is a personal web app, installable as a PWA, served from the Omarchy desktop over the Owner's tailnet.

- **Add:** the Owner adds a Source by pasting a link (YouTube or any site yt-dlp supports), sharing it from Android, or uploading or dropping an audio or video file.
- **Transcribe:** the desktop downloads it, transcribes it with Parakeet on the GPU (about 30 s for 45 minutes of audio), and labels who spoke when.
- **Read:** the Transcript reads like an article, with timestamps, chapters, speaker names, a highlight that follows playback, and click-any-word-to-seek.
- **Find:** the Library is a search-first timeline that finds Sources by what was said.
- **Keep and share:** the Owner can fix misheard words, Tag Sources, Export Transcripts as Markdown, SRT, VTT or text, ask Claude or ChatGPT (on their existing plans) for AI notes, and let Claude Code and their Bot SDK Bots search and read the Library through an MCP endpoint.
- **Ownership:** everything is stored only on the desktop and backed up to the Owner's laptop. Devices keep nothing but the app itself.

## User Stories

### Adding Sources

1. As the Owner, I want to paste a YouTube link into Notebook, so that it gets transcribed without me downloading anything.
2. As the Owner, I want to paste a link from any site yt-dlp supports, so that podcasts and talks outside YouTube work too.
3. As the Owner, I want to share a link from my Android phone's share sheet into Notebook, so that adding from the YouTube app takes one tap.
4. As the Owner on an iPhone, I want a paste-a-link field, so that I can add Sources even though iOS has no share target.
5. As the Owner, I want to upload an audio or video file with a paperclip button, so that my own recordings get transcribed.
6. As the Owner on a laptop, I want to drop a file anywhere on the Notebook window, so that adding a recording is quick.
7. As the Owner, I want uploads over 4 GB rejected with a clear message, so that I'm not left waiting on something that won't work.
8. As the Owner, I want to be told when a link is already in my Library, and offered to transcribe it again anyway, so that I don't create duplicates by accident.
9. As the Owner, I want playlist links and live streams refused up front with a clear reason, so that I don't queue things that can't be transcribed.
10. As the Owner, I want the title, channel, duration, upload date and chapters picked up from the link automatically, so that my Library is organised without typing.

### Transcription progress and failures

11. As the Owner, I want to see each Source's stage (Waiting, Downloading n%, Transcribing n%, Detecting speakers), so that I know how long until I can read it.
12. As the Owner, I want progress to update on its own while something is running, so that I don't have to refresh.
13. As the Owner, I want failed and in-progress Sources pinned in a "needs attention" strip at the top of the Library, so that an old failure doesn't get buried.
14. As the Owner, I want each failure explained in plain words (private video, unavailable, unsupported site, needs login, rate-limited, yt-dlp may be outdated), so that I know whether it's worth retrying.
15. As the Owner, I want Retry offered only when retrying can help, so that I don't waste time on hopeless cases.
16. As the Owner, I want to remove a failed Source, so that my Library stays clean.
17. As the Owner, I want a Source that keeps crashing the worker to fail after 3 attempts, so that one bad file doesn't block everything else.
18. As the Owner, I want long recordings (an hour or more) handled without limits, so that full lectures and episodes work.

### Library

19. As the Owner, I want my Library shown as a timeline grouped by Today, Yesterday, This week and Earlier, so that I find things by when I added them.
20. As the Owner, I want each timeline entry to show what was said (a Transcript snippet) rather than a thumbnail, so that I recognise Sources by content.
21. As the Owner, I want a big search box that searches the full text of every Transcript and every title, so that I can find "that talk about consensus".
22. As the Owner, I want each search hit to show the matching line with its timestamp and speaker, so that I can judge it before opening it.
23. As the Owner, I want clicking a search hit to open the reader at that exact moment, so that I land where it was said.
24. As the Owner, I want word variants to match ("test" finds "tested"), so that search forgives my wording.
25. As the Owner, I want to Tag Sources with any number of Tags, so that I can group them my way.
26. As the Owner, I want filter chips for my Tags and for channels under the search box, so that I can narrow the Library in one tap.
27. As the Owner, I want selected chips to narrow results (all selected Tags must match) and search to run within them, so that filtering is predictable.
28. As the Owner, I want a friendly empty Library that tells me to paste a link, so that I know how to start.
29. As the Owner, I want removed Sources kept in Recently deleted for 30 days, so that a mis-tap on my phone is recoverable.
30. As the Owner, I want to restore a Source from Recently deleted, so that I can undo a removal.

### Reading

31. As the Owner, I want the Transcript laid out as a comfortable serif reading column with real paragraphs, so that reading an hour of speech feels like reading an article.
32. As the Owner, I want each paragraph's start time in the margin, clickable to play from there, so that I can listen to any part.
33. As the Owner, I want to click any word to play from that word, so that I can check exactly what was said.
34. As the Owner, I want the word being spoken subtly highlighted during playback, so that I can follow along.
35. As the Owner, I want the view to follow playback automatically, and stop following while I scroll by hand, so that it helps without fighting me.
36. As the Owner, I want chapters (from YouTube, or AI-generated when there are none) shown as headings and listed in an Outline, so that I can jump between sections.
37. As the Owner, I want the Outline to list paragraph starts when a Source has no chapters, so that long Transcripts are still navigable.
38. As the Owner, I want "uh/um" hidden by default with a toggle to show them, so that the text reads cleanly but stays faithful when I need it.
39. As the Owner, I want words the model was unsure of marked with a faint dotted underline, so that I can spot likely misheard names.
40. As the Owner, I want find-in-transcript to list every match with its timestamp and jump to it, so that I can navigate a long Transcript by keyword.
41. As the Owner on desktop, I want a slim sticky player bar with play/pause, time, find and a video toggle, so that playback controls never get in the way of reading.
42. As the Owner on a phone, I want a bottom dock with play/pause, skip ±10 s and a scrubber marked at each paragraph, so that controls are within thumb reach.
43. As the Owner, I want YouTube Sources to play through the YouTube player, hidden until I ask for the video, so that reading comes first.
44. As the Owner, I want Sources whose video blocks embedding, or has since been deleted, to play from the audio Notebook kept, so that playback always works.
45. As the Owner, I want uploaded files to play back as audio, so that my own recordings can be followed like any other Source.

### Speakers

46. As the Owner, I want speakers detected automatically on every Source, so that podcasts and interviews show who said what.
47. As the Owner, I want each speaker change to start a new paragraph, marked with the speaker's name and a coloured dot, so that conversations are easy to follow.
48. As the Owner, I want speaker labels hidden when only one person speaks, so that lectures stay uncluttered.
49. As the Owner, I want to rename "Speaker 2" to a real name once and have it apply across the Source, so that the Transcript reads naturally.
50. As the Owner, I want to reassign a paragraph to a different speaker, so that I can fix a misattributed answer.
51. As the Owner, I want to reassign speech "from this word onward", so that I can fix a speaker change detected in the wrong place.
52. As the Owner, I want to merge two speakers, so that one person split in two becomes one.
53. As the Owner, I want to re-detect speakers on a Source (with a warning that names and corrections reset), so that I can recover from a bad result.

### Editing

54. As the Owner, I want to rename a Source, so that cryptic file names become meaningful.
55. As the Owner, I want to edit a Segment's text in place, so that I can fix misheard words and names.
56. As the Owner, I want a warning before editing a Segment that contains a speaker change, so that I know a speaker label may shift.
57. As the Owner, I want edits reflected in search, Export and agent reads, so that my corrections are the version everything uses.
58. As the Owner, I want a warning before re-transcribing a Source that my edits will be replaced, so that I don't lose work by accident.

### Export

59. As the Owner, I want to Export a Transcript as Markdown with front matter, timestamped paragraphs, chapter headings and speaker names, so that it lives in my notes.
60. As the Owner, I want YouTube timestamps in the Markdown Export to link to that moment in the video, so that the notes stay connected to the source.
61. As the Owner, I want SRT and VTT Exports with cues split at speaker changes, so that I can use them as subtitles.
62. As the Owner, I want a plain-text Export, so that I can paste a Transcript anywhere.
63. As the Owner, I want an Export to download to whatever device I'm using, so that I can keep a copy where I need it.
64. As the Owner, I want to Export the whole Library (or the current Tag filter) as a zip of Markdown files, optionally with audio, so that I have a portable copy.
65. As the Owner, I want the option to include AI notes in a Markdown Export, clearly labelled as generated, so that I can keep them with the text.

### AI notes

66. As the Owner, I want to press "Generate AI notes" on a Source and get a summary, timestamped key points, and chapters when the Source has none, so that I understand a long recording quickly.
67. As the Owner, I want AI notes generated by my Claude plan by default, with a per-request option to use ChatGPT, so that I use plans I already pay for.
68. As the Owner, I want AI notes to run only when I ask, so that my plan usage and data leave the machine only by choice.
69. As the Owner, I want AI notes shown in a collapsible card above the Transcript, labelled "Generated by Claude · date", so that machine text is never mistaken for what was said.
70. As the Owner, I want key-point timestamps in AI notes to seek the player, so that I can hear the part behind each point.
71. As the Owner, I want AI notes marked stale after I edit the Transcript, with an offer to regenerate, so that notes and text don't silently disagree.
72. As the Owner, I want a specific message when AI notes fail (login expired, usage limit reached, timeout or a changed CLI), so that I know what to do next.

### Access, devices and reliability

73. As the Owner, I want to open Notebook from my phone, laptop and desktop at one address on my tailnet, so that my Library is everywhere I am.
74. As the Owner, I want to install Notebook as an app on my phone's home screen, so that it opens like a native app.
75. As the Owner, I want Notebook to start when I open it or press a desktop shortcut, so that it isn't running when I'm not using it.
76. As the Owner, I want Notebook's server to stop itself after 15 minutes idle and the worker to exit when there's no work, so that GPU memory is free for other things.
77. As the Owner, I want a clear "Can't reach omarchy" screen with Try again when my desktop is unreachable, so that I know why nothing loads.
78. As the Owner, I want no login screen, so that opening Notebook on my own devices is instant.
79. As the Owner, I want my Library stored only on my desktop, in one database file plus a media folder, so that I own it completely.
80. As the Owner, I want daily database snapshots and encrypted off-disk backups to my laptop, so that a disk failure doesn't lose my Library.
81. As the Owner, I want a warning in the app when the last off-disk backup is more than 7 days old, so that silent backup failures get noticed.
82. As the Owner, I want backups checked monthly by reading part of them back, so that I know they restore.
83. As the Owner, I want yt-dlp kept current automatically, so that YouTube changes don't silently break adding links.
84. As the Owner, I want one command to build and restart Notebook after a code change, so that shipping updates is easy.

### Agents

85. As the Owner using Claude Code, I want to say "transcribe this link" and have Claude add it to Notebook, so that I never leave my terminal.
86. As the Owner using Claude Code, I want to ask "what did that lecture say about binary search?" and have Claude search my Library and cite timestamps, so that my Transcripts become a knowledge source.
87. As the Owner using Claude Code, I want to `@`-mention a Transcript to pull it into the conversation, so that I can work with it directly.
88. As the Owner, I want my Bot SDK Bots to have a Notebook Connection, so that my Bots can search, read and add Sources.
89. As the Owner, I want long Transcripts delivered to agents in pages, so that they don't overflow an agent's context.
90. As the Owner, I want agents to be able to read and add but never edit, delete or export, so that an agent can't damage my Library.
91. As the Owner, I want each agent client to use its own named token that I can revoke in Settings, so that I can cut off one client without affecting the others.
92. As the Owner, I want the Notebook Connection in my Bot SDK available only to my account there, so that other users can't reach my Library.
93. As the Owner, I want Bots to read Notebook without asking for approval each time, but to have adding a Source reviewed, so that reading is smooth and GPU work isn't queued silently.

## Implementation Decisions

### Shape of the system

- **Monorepo:** pnpm and Turborepo, re-scaffolded with Better-T-Stack as follows:
  - A Hono server on Bun.
  - A TanStack Router SPA with the PWA addon.
  - SQLite through Drizzle.
  - oRPC.
  - No auth, no Docker.
  - Lefthook, oxlint/oxfmt, evlog and the existing agent tooling.
    This is the first build step, because the current scaffold still has Postgres and Better Auth. ("Running Notebook always-on"; ADR 0001, ADR 0002.)
- **Processes:** two.
  - The **server** (Bun) serves the built web app, the oRPC API, the upload route, media files, `POST /mcp`, and AI-notes generation.
  - The **transcriber** worker (Python with uv) downloads, normalises, transcribes and diarizes.
  - They share one SQLite file in WAL mode with a 5 s busy timeout. Drizzle owns the schema and migrations; the worker writes plain SQL against it. ("Data model and media layout".)
- **Location and access:**
  - The Library lives in `~/.local/share/notebook/` (database, media, backups, models). Development uses a separate data directory in the repo.
  - The server listens only on `127.0.0.1:4310`. `tailscale serve` publishes it at `https://omarchy.<tailnet>.ts.net/` and never Funnel. ("Running Notebook always-on".)
- **On-demand lifecycle:**
  - A systemd user socket on `127.0.0.1:4310` starts the server on the first connection, whether from a desktop keybind opening the app window or a phone over the tailnet. Linger is off, and the server exits after 15 minutes without requests.
  - The server starts the worker unit when a Source is queued. The worker exits 5 minutes after the queue empties, and runs at `Nice=10`.
  - If Bun can't take a socket-activated descriptor, `systemd-socket-proxyd` fronts it. ("Running Notebook always-on".)
- **Ops:**
  - One command builds and restarts both units.
  - Logs go to journald.
  - A weekly timer upgrades only yt-dlp in the worker's environment.
  - A daily timer takes a SQLite backup snapshot (keeping 14).
  - A restic job follows it to the laptop. ("Off-disk backups".)

### Schema

From "Data model and media layout", "Organising the Library", "Speaker labels", "AI reading help" and "Agent access":

- **source:**
  - `id`, `kind` (youtube | url | upload), `title`, `url`, `normalized_url` (YouTube video id or normalised URL, for duplicate detection), `channel`, `duration_sec`, `upload_date`, `playable_in_embed`, `chapters` (JSON title + start), `audio_path`, `added_at`, `deleted_at`.
  - The metadata columns are nullable.
- **transcription:** exactly one per Source, reset in place on retry.
  - `status` (queued | downloading | transcribing | diarizing | done | failed), `progress` (0–1), `attempts`, `error_kind` (private | unavailable | unsupported | login | rate-limited | outdated | other), `error_message`, `started_at`, `finished_at`.
- **segment:** `source_id`, `idx`, `start_ms`, `end_ms`, `text`, `words`, `edited_at`.
  - `words` is a JSON array of `{ text, start, end, p, spk }`. `end` is the next word's start, because the model has no true word ends.
- **speaker:** `source_id`, `id`, `name`, `color`.
- **tag** and **source_tag** (many-to-many).
- **ai_notes:** `source_id`, `provider`, `model`, `created_at`, `content` (JSON summary, key points with timestamps, chapters), and the Transcript revision it was made from.
- **agent_token:** `id`, `name`, hashed secret, `created_at`, `last_used_at`, `revoked_at`.
- **Search:** an FTS5 index with `porter unicode61` over Segment text and Source titles, kept in sync by triggers. A hit resolves to Source, Segment and `start_ms`.
- **Recently deleted:** Remove sets `deleted_at`. An hourly purge hard-deletes Sources deleted more than 30 days ago, along with their media folder. Deleted Sources are excluded from the Library, search, filters, Export and agents.

### Transcription pipeline (worker)

From `docs/transcription.md`, "What onnx-asr output looks like as readable text", "Media URL ingestion and synced playback" and "Local speaker diarization options":

- **Claim:**
  - Poll every 2 s while awake, and claim the oldest queued row in one `UPDATE … RETURNING` transaction.
  - On start, requeue rows stuck mid-pipeline and increment `attempts`. After 3 attempts the row is `failed`.
- **Fetch (URL Sources):**
  - yt-dlp as a pinned Python library, keeping its native audio (YouTube gives Opus/WebM, with no re-encode).
  - Fill metadata from its info dict.
  - Reject live streams via `live_status`, and reject playlist URLs ourselves.
  - Classify failures from the error text into `error_kind`, reporting extractor errors as "yt-dlp may be outdated".
- **Uploads:** streamed to disk by the server, up to 4 GB, then transcoded by the worker to 48 kbps mono Opus WebM. The original is deleted.
- **Normalise:** ffmpeg to a temporary 16 kHz mono WAV.
- **Transcribe:**
  - onnx-asr, Parakeet TDT 0.6b v3 on CUDA, loading voxtype's existing model files.
  - Silero VAD on CPU with `min_silence_duration_ms=1000, speech_pad_ms=100`. The default settings produce tiny Segments that Parakeet garbles into Cyrillic.
  - With timestamps, batch size 8, and the model loaded once per worker life.
  - Rebuild words from SentencePiece tokens: a leading space starts a word, and timestamps are token starts on an 80 ms grid.
- **Diarize:**
  - Nemotron-3-Diarization through onnxruntime-gpu: the numpy port, offline mode, fp32, loaded once.
  - Its model files are regenerated once from NVIDIA's official checkpoint and kept with the OpenMDW licence and pinned checksums.
  - Each word takes the speaker with the most probability over its span, capped at 0.6 s. A change within 3 words of a sentence end snaps to it.
  - Speakers under 1% of words merge into a neighbour. "Speaker n" is numbered by first appearance.
- **Store:** write Segments, words and speakers in one transaction, then set `done`. Delete the WAV, and keep `audio.webm` (or yt-dlp's native file) for playback.
- **Progress:** update `progress` within each stage.

### Transcript rendering (one shared deep module)

Used by the reader, every Export format, and agent Markdown, so all of them show the same text.

- **Input:** a Source's Segments with words and speakers, plus options (hide fillers, include speakers, format).
- **Paragraphs:** rebuild sentences from words. Start a new paragraph on every speaker change and, within a speaker, before a sentence when:
  1. the pause before it is 4 s or more;
  2. the pause is 1.5 s or more and the paragraph has 30 or more words;
  3. adding the sentence would pass 120 words and the paragraph has 30 or more;
  4. the paragraph has reached 200 words.
     ("What onnx-asr output looks like as readable text".)
- **Fillers:** "uh", "um", "er", "ah", "hmm", "mm" and "erm" are kept in storage and stripped on render when asked, repairing commas and capitals.
- **Outputs:**
  - Reader paragraph models.
  - Markdown: front matter, `[mm:ss]` paragraph stamps (YouTube ones linking with `&t=`), chapter headings, `**Name:**` speaker prefixes, and an optional labelled AI-notes section.
  - SRT and VTT: one cue per Segment, split at speaker changes, using `<v Name>` in VTT and `Name:` in SRT.
  - Plain text.
  - Paged agent Markdown, 8,000 characters or less per page, by time range or cursor.
- **Edited Segments** render from their text and take the majority speaker of their former words.

### Server API (oRPC plus a few plain routes)

- **Library:**
  - List the timeline by date bucket, with the needs-attention set first.
  - Filter by Tags (all must match) and channel.
  - Full-text search returning hits of Source, Segment, `start_ms`, excerpt and speaker.
  - Recently deleted list, restore and purge.
- **Sources:**
  - Add by URL. This checks duplicates by `normalized_url` and returns the existing Source unless the Owner chose "transcribe again".
  - Get with Segments, speakers, chapters and AI notes.
  - Rename, edit Segment text, re-transcribe (warns about edits), re-detect speakers (warns about speaker resets), retry, remove.
- **Speakers:** rename, reassign a paragraph, reassign from a word onward, merge.
- **Tags:** create, rename, delete, add to and remove from Sources.
- **Progress:** the web app polls every 2 s while any Transcription is queued, downloading, transcribing or diarizing, and stops when none are.
- **Plain routes:**
  - Streaming upload (4 GB cap).
  - Media files with HTTP Range support, which Safari needs for seeking.
  - Export downloads: per Source in Markdown, SRT, VTT or text; Library zip, following the active filter, with optional audio.
- **Settings:** agent tokens (create, shown once; list; revoke), backup status (last off-disk backup, last verified), AI-provider login status.
- **AI notes:**
  - Generate on request, on Claude (`sonnet`) by default or ChatGPT (`gpt-6-luna`) per request. Each is one structured call with a JSON schema. Very long Transcripts are split into parts and the notes merged.
  - The CLIs run isolated:
    - absolute binary paths, not mise wrappers;
    - an empty working directory under `$XDG_RUNTIME_DIR`;
    - a minimal environment, with tools, MCP servers, settings, slash commands and session persistence all off;
    - a 120 s timeout, and one call at a time per provider.
  - Log in is checked before the call without spending usage. Failures are classified as logged out/expired, usage limit, rate limited, bad model, timeout, CLI changed, or no structured output.
  - Notes are stored per Source with the Transcript revision, and shown as stale after edits. ("Calling Claude and ChatGPT through their CLIs", "AI reading help".)

### Agent access

From "Agent access: CLI, Claude Code skill, MCP" and "How the Bot SDK can use Notebook":

- **Endpoint:** a stateless `POST /mcp` on the same Hono process (`@modelcontextprotocol/server` v2 `createMcpHandler`). It requires `Authorization: Bearer <agent token>` and checks Host and Origin. The PWA routes don't require a token. (ADR 0003.)
- **Tools:**
  - `search { query, tags?, limit? }` returns hits with Source id, title, Segment, `startMs`, speaker and excerpt.
  - `list_recent { limit? }`
  - `get_source { id }` returns metadata, status, speakers, and an outline of chapters or paragraph starts.
  - `get_transcript { id, fromMs?, toMs?, cursor?, format: markdown|segments }` returns pages of at most 8,000 characters.
  - `get_status { id }`
  - `list_tags`
  - `add_source { url, tags? }` is idempotent on `normalized_url`.
  - All tools except `add_source` declare `readOnlyHint`. There's no edit, delete, Export or upload tool.
- **Resource:** `notebook://source/{id}/transcript`, for `@` mentions in Claude Code.
- **Claude Code skill:** guidance only, stored in the repo and installed to the user's skills directory by the deploy command. Its description triggers on transcribing links and on asking what a talk, lecture or podcast said. Claude Code registers the endpoint at user scope with an HTTP header.
- **Bot SDK** (changes live in the bot-sdk repo):
  - A per-Connection `privateNetwork` opt-in so its guarded fetch can reach the `*.ts.net` address.
  - The Host's token hook returns the Notebook token only for the Owner's user id, and the Settings row is hidden from other users.
  - Read tools are `approvalFree`; `add_source` stays Auto-reviewed.

### Web app

- **Library ("Journal" design; "Library and adding a Source"):**
  - A search box on top, with filter chips for Tags and channels below it.
  - The needs-attention strip.
  - A timeline grouped by Today, Yesterday, This week and Earlier, whose entries show title, channel or "Upload", duration, Transcript snippet and Tag chips.
  - Inline progress and failure entries, with Retry (only for rate-limited or outdated failures) and Remove.
  - A composer pinned to the bottom with a paste field and paperclip, drop-anywhere on desktop, and a Web Share Target (GET, reading the URL from `text`) for Android and desktop Chrome.
  - Dialogs for "already here" duplicates and an empty state.
  - A full-screen "Can't reach omarchy" state with Try again and the last-connected time.
- **Reader ("Article" design; "Reader layout"):**
  - A serif column about 68 characters wide, with margin timestamps on desktop.
  - Chapter headings plus an Outline (chapters, or paragraph starts), with AI chapters badged.
  - A spoken-word highlight with follow-along that pauses on manual scroll, and click-to-seek on words and timestamps.
  - Find as a jump list of hits, a filler toggle (hidden by default), and dotted underlines on uncertain words.
  - Speaker name and colour at each speaker run, with menus to rename, reassign and merge.
  - In-place Segment editing.
  - The AI-notes card.
  - Desktop: a sticky top bar, with video hidden until toggled. Phone: a bottom dock.
  - Playback:
    - YouTube Sources use the IFrame API with `playsinline=1`, a tap to start, and `getCurrentTime()` polled per animation frame. Right after a seek, the seek target is trusted for about 400 ms.
    - Embed-disabled or vanished videos and uploads use an `<audio>` element on the kept audio.
- **PWA:**
  - The manifest has name, icons, `start_url`, `display`, and a share target.
  - The service worker caches only the app shell, never Library data. ("PWA offline storage and install over Tailscale"; the Owner's decision that devices keep no Library data.)
  - Test the PWA on a production build.

### Pre-use checklist (Owner, by hand)

From "Running Notebook always-on" and "AI reading help":

- **Tailscale:** log in, run `tailscale set --hostname=omarchy`, enable MagicDNS and HTTPS certificates, and settle the tailnet name before any device installs the app. Never rename either afterwards.
- **AI providers:** run `claude setup-token`, because the CLI login expires around 2026-11-27. Turn off model training in Claude's privacy settings and ChatGPT's data controls.
- **Backups:** set up the laptop as the restic target, with SFTP or a REST server over the tailnet, and the password stored in a protected file plus the password manager.
- **Bot SDK:** apply its `privateNetwork` change and add the Notebook Connection.

## Testing Decisions

- **What a good test is:** it exercises external behaviour through the four seams below, and asserts on what the Owner, an agent, or the stored data would see: responses, rows, rendered text, files. It never asserts on internal calls or private functions. Prefer real SQLite (a temp file per test) over mocks, and fake only the boundaries we don't own: yt-dlp, the speech and diarization models, the AI CLIs, and the clock.
- **Seam 1, the server's HTTP boundary:** the Hono app called in-process with a temp SQLite file and temp media directory. It covers:
  - the oRPC procedures (Library, filters, search, Recently deleted, editing, Tags, speaker corrections);
  - upload limits;
  - media Range responses;
  - Export downloads in every format, plus the zip;
  - `/mcp`: token required, revoked token rejected, Host/Origin checks, every tool's shape, `add_source` idempotence, transcript paging at 8,000 characters or less;
  - AI notes through a fake CLI binary that emits recorded success and failure outputs: classification, storage, staleness after edits.
- **Seam 2, the worker's job boundary:** insert a queued Transcription into a temp database, run one worker cycle, and assert the resulting rows and files. It covers status and progress transitions, the three-attempt rule, crash-requeue on start, failure classification from recorded yt-dlp error texts, upload transcode and cleanup, and diarization alignment and ghost-speaker merging. Downloading, ASR and diarization sit behind adapters with fakes returning recorded outputs.
  - **Prior art:** the research's `test_segshape.py` and `test_align.py` (on the research branches) become starting cases.
  - **GPU smoke test:** a separate opt-in test runs the real models on a short public-domain clip, and is not part of the default test run.
- **Seam 3, the transcript-rendering module:** tested at its interface. Fixtures are the research's real outputs: the MIT 6.006 excerpt, and the NASA clip with speaker labels. It covers paragraph rules, filler stripping and repair, speaker runs, edited-Segment rendering, Markdown, SRT, VTT and text output, and agent paging. Snapshot-style expectations are acceptable for whole-document output.
- **Seam 4, end-to-end:** a handful of Playwright flows against a production build seeded with finished Sources:
  1. Paste a link, see progress, then open the reader.
  2. Search, click a hit, and the reader opens at the timestamp.
  3. Click a word and playback seeks there (using the audio fallback, so no network is needed).
  4. Edit a Segment and see it in search and Export.
- **Not tested automatically:** systemd units, Tailscale, restic and real AI CLI calls. These are covered by a documented manual checklist and by the deploy command's CLI flag smoke test.

## Out of Scope

- Languages Parakeet v3 doesn't cover (e.g. Hindi, Urdu).
- Multi-user use or public deployment, which would need auth and Postgres (ADR 0001, 0002).
- A native mobile app; the PWA covers phones.
- Cloud storage or sync of the Library. AI notes are the only text that leaves the machine, and only on request.
- Offline reading on devices: devices keep no Library data, and Export is the only way a Transcript lands on one.
- A local LLM: AI notes use the Owner's Claude and ChatGPT plans.
- In-app Q&A or chat: Q&A is done by agents through the MCP endpoint.
- A `notebook` command-line tool.
- Recognising the same speaker across Sources, and splitting one speaker into two.
- Agents editing, deleting or exporting.
- The Bot SDK's own changes (the `privateNetwork` opt-in and the Notebook Connection), which are built in the bot-sdk repo.

## Further Notes

- **Terms are grey.** Both providers' terms are a grey zone for scripted use of subscription CLIs. Notebook keeps AI calls owner-triggered and on demand for that reason. Claude Code may make `--bare` the default for `-p`, which would ignore subscription logins; ChatGPT is the fallback.
- **CLI drift.** mise pins the Claude and Codex CLIs to `latest`, so flags drift. The deploy command's smoke test is the early warning.
- **Fixed address.** The ts.net hostname is the PWA's origin. Changing it after installs loses every install.
- **Prototypes:** the Journal Library and the Article reader were prototyped on throwaway branches (`prototype/library`, `prototype/reader`). Those branches show the chosen layouts but are not production code; rewrite rather than promote.
- **Research:** every research note lives on a `research/*` branch and is linked from its ticket. It includes measured numbers for speed, VRAM and accuracy.
