# Data model and media layout

Type: grilling
Status: resolved
Blocked by: 03, 04

## Question

What are the tables and files? Settle: the Source, Transcript, Segment and Transcription fields; whether word timings are stored per Segment (jsonb/JSON) or in their own table; the FTS5 setup for Library-wide and in-Transcript search (a hit must return the Source, the matching Segment and its timestamp, for "Library and adding a Source"); how the Python worker claims and updates Transcriptions in SQLite (WAL, polling interval, crash recovery); and the on-disk media layout and cleanup, and which yt-dlp metadata fields become columns. (Settled by the Owner: URL Sources keep their downloaded audio too.)

## Answer

Decided with the Owner (grilling, 2026-11-22). The Owner asked to settle this ahead of its blockers. Items marked _provisional_ are confirmed or revised by "Reader layout"; Segment shape details may be tuned by "What onnx-asr output looks like as readable text".

**Tables** (SQLite, schema and migrations owned by Drizzle in `packages/db`):

- `source`:
  - `id`, `kind` (`youtube` | `url` | `upload`), `title`, `url`, `normalized_url` (YouTube video id or normalised URL, for duplicate detection), `channel`, `duration_sec`, `upload_date`, `playable_in_embed`.
  - `chapters` (JSON of title + start; its display is decided by "Reader layout"), `audio_path`, `added_at`, `deleted_at`.
  - Every yt-dlp metadata column is nullable.
- `transcription`: exactly one per Source; a retry resets it in place, with no attempt history. Fields: `status` (`queued` | `downloading` | `transcribing` | `done` | `failed`), `progress` (0–1), `attempts`, `error_kind` (private, unavailable, unsupported, login, rate-limited, outdated, other), `error_message`, `started_at`, `finished_at`.
- `segment`: `source_id`, `idx`, `start_ms`, `end_ms`, `text`, `words` (JSON list of text, start, end, confidence: _provisional_), `edited_at`.
- **Search:** an FTS5 index with tokenizer `porter unicode61` over Segment text and Source titles, kept in sync by triggers. A hit returns the Source, the Segment and its `start_ms`.

**Recently deleted:** Remove sets `deleted_at`. An hourly purge hard-deletes Sources deleted more than 30 days ago, together with their media folder. Deleted Sources are hidden from the Library, search and Library Export.

**Media:** each Source has `media/<source-id>/audio.webm` (or yt-dlp's native extension).

- Uploads are transcoded to Opus at 48 kbps mono in WebM (about 22 MB/hour; plays on iOS Safari 17.5+).
- URL Sources keep yt-dlp's audio as downloaded.
- The original upload and the temporary 16 kHz WAV are deleted after transcription.
- Uploads stream to disk and are rejected above 4 GB with a clear message.

**Queue and processes:**

- The worker claims one Transcription at a time and polls every 2 s while awake.
- On start, it requeues rows stuck mid-transcription and increments `attempts`. After 3 attempts the row is marked `failed`.
- Both processes open the file in WAL mode with a 5 s busy timeout. The Python worker writes plain SQL against Drizzle's schema; schema changes always start in `packages/db`.

**Live progress:** the web app polls the server every 2 s while any Transcription is queued, downloading or transcribing, and stops when none are. There is no push channel.
