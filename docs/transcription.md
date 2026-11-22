# Transcription pipeline

Read this before working on uploads, jobs, the worker, or transcript storage.

## Flow

1. **Submit.** The web app sends either a file (streamed by a plain Hono route in `apps/server` into `$MEDIA_DIR/<id>/source.<ext>`) or a URL (oRPC procedure). Both insert a `transcription` row with `status = 'queued'` and `NOTIFY transcription_queued`.
2. **Claim.** The worker (`apps/transcriber`, Python) takes the oldest queued row with `SELECT … FOR UPDATE SKIP LOCKED`, sets `status = 'processing'`, and records `progress` as it goes. It wakes on `LISTEN transcription_queued` and also polls every 30 s, so a missed notify only adds a delay. On startup it requeues rows stuck in `processing`.
3. **Fetch.** For URLs, `yt-dlp -x` downloads the audio and fills in `title` and `duration`.
4. **Normalise.** `ffmpeg` converts to 16 kHz mono WAV (`$MEDIA_DIR/<id>/audio.wav`).
5. **Transcribe.** onnx-asr runs Parakeet TDT 0.6b v3 with Silero VAD and timestamps. The model loads once, when the worker starts.
6. **Store.** Insert one `transcript_segment` row per VAD segment (`idx`, `start_ms`, `end_ms`, `text`, and `words` as jsonb with per-token times), then set `status = 'done'`. On failure, set `status = 'error'` with the message. Delete `audio.wav` afterwards; keep or remove the source according to a setting.

The server and web app only read rows, so the worker can restart at any time without losing jobs.

## Why these choices

- **onnx-asr instead of voxtype.** The `voxtype transcribe` CLI on PATH is a CPU build without Parakeet. The CUDA build fails on audio longer than about 5 minutes and returns text with no timestamps. onnx-asr loads the same model files from `~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3`, splits audio with VAD, and returns per-segment and per-token timestamps.
- **Measured on this machine (RTX 3060, 12 GB).** 10 minutes of audio took 10 s on CUDA, versus about 4.5× slower on CPU. An hour of audio takes about 1 minute; the model loads in about 4 s.
- **Postgres table as the queue.** Both the Bun server and the Python worker can use it, so there is no Redis or pg-boss. One worker processes one job at a time, since the GPU is the bottleneck.
- **Separate Python worker.** onnx-asr and onnxruntime-gpu are Python-only. Keeping GPU work out of the API process also lets the API move to a public host later while the worker stays on this machine.

## Config (worker env)

| Var             | Default                                              |
| --------------- | ---------------------------------------------------- |
| `DATABASE_URL`  | same as `packages/db`                                |
| `STT_MODEL_DIR` | `~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3` |
| `MEDIA_DIR`     | `<repo>/data/media` (git-ignored)                    |
| `STT_PROVIDERS` | `CUDAExecutionProvider,CPUExecutionProvider`         |

Python deps (managed with `uv`): `onnx-asr[gpu,hub]` (Silero VAD downloads from HF on first run), `psycopg[binary]`. System tools: `ffmpeg`, `yt-dlp`.

## Running it

- Dev: `pnpm db:start`, `pnpm dev`, and `uv run` the worker from `apps/transcriber`.
- Always-on: systemd user units for the server and worker, with `tailscale serve` providing HTTPS on the tailnet. The PWA install prompt requires HTTPS.
- The voxtype daemon keeps its own copy of the model in VRAM. Both fit on 12 GB.
