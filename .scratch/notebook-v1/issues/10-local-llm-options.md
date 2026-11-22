# Local LLM options on the RTX 3060

Type: research
Status: open
Blocked by:

## Question

Which local LLM setup can summarise and answer questions over a Transcript on this machine (RTX 3060 12 GB, shared with the voxtype daemon at 3.3 GB VRAM, and with the transcription worker at about 5 GB while it runs)? Compare runtimes (Ollama, llama.cpp server, others worth considering; check what's already installed) and current open models that fit in about 8 GB at a usable quantisation. Measure on a real Transcript from the segment-shape research: tokens/s, time to summarise a 45-minute lecture (about 10k words / 13k tokens), whether the context window holds a whole Transcript or needs chunking, and output quality for a summary, chapter titles with timestamps, key points, and a grounded answer that cites timestamps. Also: model load time, VRAM while idle and loaded, and whether it can be started on demand and stopped when idle like the worker.
