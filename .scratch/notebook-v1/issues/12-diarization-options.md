# Local speaker diarization options

Type: research
Status: resolved
Blocked by:

## Question

What can label who-spoke-when locally on this machine, and how well? Compare current options: pyannote segmentation-3.0 (onnx-asr already lists it as a VAD), pyannote/community pipelines, NeMo Sortformer or other ONNX diarizers, and sherpa-onnx speaker embeddings with clustering. Also look at what voxtype's meeting mode does (`[meeting.diarization]`, backend "simple"). Measure on the NASA podcast clip from the segment-shape research (2–3 speakers) and one longer multi-speaker recording: speed, VRAM, accuracy (does it find the right number of speakers, and are turn boundaries close), licence and gated-model requirements, and how to align speaker turns with our Segments and word timings, including when a turn changes mid-Segment.

## Answer

Research: [`research/diarization-options.md` on branch `research/diarization-options`](https://github.com/Daanish2003/notebook/blob/research/diarization-options/research/diarization-options.md). Includes `nemotron_onnx.py` (a numpy + onnxruntime port), `align.py` with tests, and scoring scripts.

Scored against NASA's own speaker-labelled transcripts aligned to Parakeet words (right speaker per word, not DER), on three tests: a 4-minute clip, a 55-minute episode with 3 speakers, and a 91-minute episode with 5 speakers.

- **Winner: Nemotron-3-Diarization** (NVIDIA, 2026-09; OpenMDW-1.1, not gated, up to 8 speakers).
  - It found the right speaker count every time.
  - Words with the right speaker: 100%, 97.9% and 99.7%.
  - 91% of speaker changes land within 1 s.
  - It runs on the worker's existing onnxruntime-gpu: **about 9 s of GPU per hour of audio** (412× realtime), with a flat 726 MiB of VRAM. On CPU it takes 30–47 s for 55 minutes.
  - The ONNX files come from an unofficial export. Its script can regenerate them from NVIDIA's checkpoint.
- **Others:**
  - Sortformer has only 4 speaker slots (64.6% with 5 speakers), and its VRAM grows to 4.6 GB.
  - sherpa-onnx (pyannote segmentation plus clustering) had 91–95% accuracy with many ghost speakers, a per-model threshold, and was no faster on its CUDA build.
  - pyannote 3.1 is gated, so it wasn't run.
  - voxtype's meeting diarization works per live audio source and doesn't apply to files.
- **Speaker changes inside a Segment are common** (about a third of Segments), so the **speaker is stored per word**.
- **Alignment:** each word takes the speaker with the most probability over its span (capped at 0.6 s, since there are no true word end times). A change within 3 words of a sentence end snaps to that sentence end. Start a new paragraph on each speaker change; the segment-shape rules apply within each speaker.
- **Failure modes:** a similar-voiced guest mislabelled for a whole answer; the first ~10 s of a newly arriving speaker given to the previous one; backchannels 60–70% right; tiny ghost speakers under 1% of words.
