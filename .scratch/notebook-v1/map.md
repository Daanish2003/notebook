# Wayfinder map: Notebook v1

Label: wayfinder:map

## Destination

A build-ready spec for Notebook v1. The Owner adds a Source (upload or media URL), it is transcribed on the Omarchy machine, and the Owner reads it in an installable PWA that is easy to read, works offline on each device, and writes every Transcript out as Export files the Owner controls. The map is done when nothing is left to decide before implementation starts.

## Notes

- Domain language: `GLOSSARY.md`. Settled architecture: `docs/adr/` and `docs/transcription.md`. Read all three before resolving any ticket.
- Skills: prototype tickets use `prototype`; UI tickets also consult `web-design-guidelines` and `shadcn`; grilling tickets use `grilling` + `domain-modeling`.
- Standing decisions (from charting):
  - Storage: the Omarchy machine is the source of truth; nothing goes to a cloud.
  - Auth: none; the tailnet is the boundary (ADR 0001).
  - Database: one SQLite file via Drizzle (ADR 0002).
  - Speech-to-text: Parakeet TDT 0.6b v3 via onnx-asr on CUDA, loading voxtype's model files directly.
  - Languages: English plus Parakeet's European languages only.
  - Media: uploads are kept as Opus audio for playback; YouTube Sources play through the embed.
- First build step after the map closes: re-scaffold with SQLite, no auth, no Docker (the current scaffold still has Postgres and Better Auth).

## Decisions so far

## Not yet specified

- **AI reading help**: summary, chapters, key points, and Q&A over a Transcript from a local LLM on the GPU. In scope, but it depends on what the reader shows, so it waits for the reader prototype.
- **Speaker labels (diarization)**: whether and how Segments carry a speaker, and how that changes paragraph grouping. Waits on the reader layout and data model.
- **Organising the Library**: tags, folders, or nothing beyond search and sort. Unclear until the library prototype shows how many Sources it takes for this to hurt.

## Out of scope

- Languages Parakeet v3 doesn't cover (Hindi, Urdu, etc.): needs another model, so it's a separate effort.
- Multi-user or public deployment: see ADR 0001. It becomes a new effort if it happens.
- Native mobile app (Expo): the PWA covers phone access for now.
- Cloud storage or sync services.
