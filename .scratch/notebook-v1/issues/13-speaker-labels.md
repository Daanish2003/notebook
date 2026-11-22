# Speaker labels

Type: grilling
Status: resolved
Blocked by: 12

## Question

Given what "Local speaker diarization options" found, how do speaker labels work in v1? Settle: whether diarization runs on every Source or only when asked; whether the speaker is stored per Segment or per word, and how mid-Segment turns are handled; naming speakers ("Speaker 1" → a name, applied across the Source); adding "new paragraph on speaker change" to the paragraph rules; how the Article reader shows speakers; how Exports show them (Markdown, SRT/VTT); and how corrections work when the diarizer gets it wrong.

## Answer

Decided with the Owner (grilling, 2026-11-22; recommendations accepted), building on "Local speaker diarization options".

1. **Runs on every Source:** a `diarizing` Transcription stage ("Detecting speakers") after transcribing, on the same 16 kHz WAV. It uses Nemotron-3-Diarization via onnxruntime-gpu, loaded once at worker start: about 9 s of GPU per hour of audio, 726 MiB VRAM, and a CPU fallback. Labels are hidden when only one speaker holds 1% or more of the words.
2. **Model files:** regenerated once from NVIDIA's official checkpoint with the export script, in a throwaway Python env. They're stored in `~/.local/share/notebook/models/nemotron-3-diarization/` with the OpenMDW-1.1 licence and pinned checksums. There's no runtime dependency on the unofficial upload.
3. **Storage:**
   - Each word in `segment.words` gets `spk`, and a `speaker` table per Source holds `source_id`, `id`, `name` and `color`.
   - Speakers under 1% of words (ghosts) are merged into the neighbouring speaker.
   - Speaker runs and paragraphs are worked out at render time, not stored.
   - Alignment follows the research: max probability over each word's span (capped at 0.6 s), with changes within 3 words of a sentence end snapped to it.
4. **Naming:** speakers start as "Speaker 1, 2, …" in order of first appearance. Renaming applies across that Source. There is no cross-Source voice identity in v1.
5. **Reader:**
   - Every speaker change starts a new paragraph, and the segment-shape paragraph rules apply within each speaker.
   - Each run starts with the speaker's name in small bold type with a coloured dot.
   - Search hits and the Outline show the speaker.
6. **Corrections:** reassign a paragraph to another speaker, reassign "from this word onward" until the next change, and merge two speakers. Splitting a speaker in two waits for later.
7. **Edited Segments:** editing drops word timings and with them per-word speakers. The Segment then takes the speaker most of its words had. The editor warns first when the Segment contains a speaker change.
8. **Exports:**
   - Markdown: speaker paragraphs start with `**Name:**`.
   - SRT/VTT: cues split at speaker changes, with VTT using `<v Name>` and SRT a `Name:` prefix.
   - Plain text: `Name: …`.
9. **Agents:** `get_transcript` Markdown includes speaker names, and `search` hits carry the speaker.
10. **Re-detect speakers:** reruns only diarization, without re-transcribing. It warns that names and corrections will be reset.
