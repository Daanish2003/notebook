# Wayfinder map: Notebook v1

Label: wayfinder:map

## Destination

A build-ready spec for Notebook v1. The Owner adds a Source (upload or media URL), it is transcribed on the Omarchy machine, and the Owner reads it in an installable PWA that fetches everything live over the tailnet and is easy to read. An Export downloads a Transcript as files to whichever device asks. The map is done when nothing is left to decide before implementation starts.

## Notes

- Domain language: `GLOSSARY.md`. Settled architecture: `docs/adr/` and `docs/transcription.md`. Read all three before resolving any ticket.
- Skills: prototype tickets use `prototype`; UI tickets also consult `web-design-guidelines` and `shadcn`; grilling tickets use `grilling` + `domain-modeling`.
- Standing decisions (from charting):
  - Storage: the Omarchy machine holds the entire Library; nothing is stored in a cloud. The one exception is AI reading help, which sends Transcript text to Claude (`claude -p`) or ChatGPT (`codex exec`, Sign in with ChatGPT) on the Owner's existing plans, only for the request being made. No local LLM. Devices keep no Library data: the PWA caches only its app shell and reads everything live over the tailnet. A device gets a copy of a Transcript only through an Export download.
  - Auth: none; the tailnet is the boundary (ADR 0001).
  - Database: one SQLite file via Drizzle (ADR 0002).
  - Speech-to-text: Parakeet TDT 0.6b v3 via onnx-asr on CUDA, loading voxtype's model files directly.
  - Languages: English plus Parakeet's European languages only.
  - Media: every Source keeps its audio on the Omarchy machine, uploads as Opus and URL Sources as the native audio yt-dlp downloaded. YouTube Sources play through the embed by default and fall back to the kept audio when embedding is disabled or the video is gone.
- Before any device installs the PWA: the Owner logs in to Tailscale, names the machine `omarchy`, enables MagicDNS and HTTPS, and finalises the tailnet name (see "Running Notebook always-on").
- First build step after the map closes: re-scaffold with SQLite, no auth, no Docker (the current scaffold still has Postgres and Better Auth).

## Decisions so far

- [PWA offline storage and install over Tailscale](issues/01-pwa-offline-storage.md): ts.net certs satisfy PWA install, but the hostname must never change once installed; share-to-app works only on Android/desktop Chrome, so a paste field is required. (Its device-storage findings went unused: devices keep no Library data.)
- [Media URL ingestion and synced playback](issues/02-media-url-ingestion.md): yt-dlp as a pinned Python library, keeping the native Opus/WebM; metadata covers the Library card; failures are classified by error text; the YouTube embed is polled for time; our own audio is served with Range support.
- [What onnx-asr output looks like as readable text](issues/03-segment-shape.md): tune VAD to `min_silence_duration_ms=1000, speech_pad_ms=100` (fixes Cyrillic drift); VAD on CPU and ASR on CUDA (45 min in about 30 s); word starts exact to 80 ms with no true ends; keep fillers but strip on render; paragraphs come from four pause/length rules.
- [Running Notebook always-on](issues/09-always-on-operation.md): started on demand by socket activation when the app opens (no linger), the server stops after 15 min idle, and the worker runs only while there's work; one Hono process on `127.0.0.1:4310` behind `tailscale serve` at `https://omarchy.<tailnet>.ts.net/`; the Library lives in `~/.local/share/notebook/` with daily DB snapshots; a weekly yt-dlp upgrade.
- [Library and adding a Source](issues/05-library-ingest-prototype.md): Variant C "Journal". Search first, a date-grouped timeline of what was said, and a paste composer pinned at the bottom; plus drop-anywhere on desktop, a "needs attention" strip for failed and in-progress Sources, and full-Transcript search hits that open the reader at the timestamp.
- [Data model and media layout](issues/06-data-model.md): `source` / `transcription` (one per Source) / `segment` with words JSON; FTS5 `porter unicode61` returns Source, Segment and timestamp; 30-day Recently deleted; 48 kbps Opus WebM for uploads; 3-attempt queue; WAL across Bun and Python; 2 s polling for progress.
- [Editing and Export](issues/07-ownership-edit-export.md): rename a Source and edit Segment text in place (word timings dropped on edit); one Source exports as Markdown, SRT, VTT or text; Export Library is a Markdown zip with optional audio.
- [Organising the Library](issues/14-organising-the-library.md): manual Tags (any number per Source) plus a free channel filter; filter chips under the search box narrow the Library (all selected Tags), search within them; Export Library follows the filter.
- [Off-disk backups](issues/15-off-disk-backups.md): restic over Tailscale to the Owner's laptop (USB fallback), DB snapshots plus media, encrypted, 7 daily / 4 weekly / 6 monthly, a monthly 5% read-back check, and an in-app warning after 7 days without an off-disk backup.
- [How the Bot SDK can use Notebook](issues/16-bot-sdk-integration-points.md): Bot SDK Connections take tools from a Streamable HTTP MCP server with a per-user bearer token, but its guarded fetch blocks tailnet addresses (needs a `privateNetwork` opt-in or Host tools); it cuts results at 10k characters, so page Transcripts at 8k or less; tools only, no resources; a stateless `@modelcontextprotocol/server` 2.4 handler mounts in Hono.
- [Agent access: CLI, Claude Code skill, MCP](issues/17-agent-access.md): one stateless `POST /mcp` for Claude Code and the Bot SDK (read tools plus idempotent `add_source`; no edit, delete or Export), per-client hashed bearer tokens (ADR 0003), a guidance-only Claude Code skill, a transcript resource for `@` mentions; Q&A moves to agents.
- [Reader layout](issues/04-reader-prototype.md): Variant A "Article". A serif reading column with margin timestamps, chapter headings plus an Outline, a subtle spoken-word highlight with follow-along, click any word to seek; B's find-as-jump-list; C's bottom dock on phones; fillers hidden by default; uncertain words dotted.

## Not yet specified

_Nothing right now. All remaining in-scope areas are tickets: AI reading help, speaker labels._

## Out of scope

- Languages Parakeet v3 doesn't cover (Hindi, Urdu, etc.): needs another model, so it's a separate effort.
- Multi-user or public deployment: see ADR 0001. It becomes a new effort if it happens.
- Native mobile app (Expo): the PWA covers phone access for now.
- Cloud storage or sync services.
- A `notebook` CLI: agents use the MCP endpoint instead (see "Agent access: CLI, Claude Code skill, MCP").
- The Bot SDK's `privateNetwork` opt-in and Notebook Connection: implemented and decided in the bot-sdk repo; this map only depends on it.
- Offline reading on devices: the Owner chose live access over the tailnet, with Export as the only way a Transcript lands on a device. [What each device keeps offline](issues/08-offline-behaviour.md) was closed for this reason.
