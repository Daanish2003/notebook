# Transcription pipeline

Read this before working on uploads, jobs, the worker, or transcript storage.

## Flow

1. **Submit.** The web app sends either a file (streamed by a plain Hono route in `apps/server` into `$MEDIA_DIR/<id>/source.<ext>`) or a URL (oRPC procedure). Both insert a `source` row plus its single `transcription` row with `status = 'queued'`.
2. **Claim.** The worker (`apps/transcriber`, Python) polls the SQLite file every few seconds, claims the oldest queued row in a single `UPDATE … RETURNING` transaction, moves `status` through `downloading` and `transcribing`, and records `progress` as it goes. On startup it requeues rows stuck mid-transcription; after 3 attempts a row is `failed`. The details are decided in the map ticket "Data model and media layout".
3. **Fetch.** For URLs, `yt-dlp -x` downloads the audio and fills in `title` and `duration`.
4. **Normalise.** `ffmpeg` converts to 16 kHz mono WAV (`$MEDIA_DIR/<id>/audio.wav`).
5. **Transcribe.** onnx-asr runs Parakeet TDT 0.6b v3 on CUDA, with Silero VAD on CPU and timestamps: `with_vad(vad, min_silence_duration_ms=1000, speech_pad_ms=100)`. The default VAD settings make tiny Segments that Parakeet garbles into Cyrillic; see the map ticket "What onnx-asr output looks like as readable text". The model loads once, when the worker starts.
6. **Store.** Insert one `segment` row per VAD segment (`idx`, `start_ms`, `end_ms`, `text`, and `words` as JSON with per-token times), then set `status = 'done'`. On failure, set `status = 'failed'` with `error_kind` and `error_message`. Delete `audio.wav` afterwards. Always keep the Source's audio for playback as `media/<source-id>/audio.webm`: uploads transcoded to 48 kbps mono Opus, and URL Sources as the native audio yt-dlp downloaded.

The server and web app only read rows, so the worker can restart at any time without losing jobs.

## Why these choices

- **onnx-asr instead of voxtype.** The `voxtype transcribe` CLI on PATH is a CPU build without Parakeet. The CUDA build fails on audio longer than about 5 minutes and returns text with no timestamps. onnx-asr loads the same model files from `~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3`, splits audio with VAD, and returns per-segment and per-token timestamps.
- **Measured on this machine (RTX 3060, 12 GB).** With the tuned settings, 45 minutes of audio takes 24–33 s (Silero on CPU, Parakeet on CUDA). Parakeet on CPU alone is about 4.5× slower. The model loads in about 4 s.
- **A SQLite table as the queue** (ADR 0002). Both the Bun server and the Python worker can use it, so there is no Redis or broker. One worker processes one job at a time, since the GPU is the bottleneck.
- **Separate Python worker.** onnx-asr and onnxruntime-gpu are Python-only. Keeping GPU work out of the API process also lets the API move to a public host later while the worker stays on this machine.

## Config (worker env)

| Var             | Default                                               |
| --------------- | ----------------------------------------------------- |
| `DATABASE_URL`  | the same SQLite file as `packages/db`                 |
| `STT_MODEL_DIR` | `~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3`  |
| `MEDIA_DIR`     | `~/.local/share/notebook/media` (dev: `./data/media`) |
| `STT_PROVIDERS` | `CUDAExecutionProvider,CPUExecutionProvider`          |

Python deps (managed with `uv`): `onnx-asr[gpu,hub]` (Silero VAD downloads from HF on first run), the stdlib `sqlite3` module. System tools: `ffmpeg`, `yt-dlp`.

## Running it

- Dev: `pnpm dev`, and `uv run` the worker from `apps/transcriber`.
- Always-on: see the map ticket "Running Notebook always-on": socket-activated systemd user services started when the app opens (the worker only while Sources are queued), one Hono process on `127.0.0.1:4310`, and `tailscale serve` at `https://omarchy.<tailnet>.ts.net/`.
- The voxtype daemon keeps its own copy of the model in VRAM. Both fit on 12 GB.
