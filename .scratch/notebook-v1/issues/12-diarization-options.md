# Local speaker diarization options

Type: research
Status: open
Blocked by:

## Question

What can label who-spoke-when locally on this machine, and how well? Compare current options: pyannote segmentation-3.0 (onnx-asr already lists it as a VAD), pyannote/community pipelines, NeMo Sortformer or other ONNX diarizers, and sherpa-onnx speaker embeddings with clustering. Also look at what voxtype's meeting mode does (`[meeting.diarization]`, backend "simple"). Measure on the NASA podcast clip from the segment-shape research (2–3 speakers) and one longer multi-speaker recording: speed, VRAM, accuracy (does it find the right number of speakers, and are turn boundaries close), licence and gated-model requirements, and how to align speaker turns with our Segments and word timings, including when a turn changes mid-Segment.
