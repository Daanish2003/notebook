# Local speaker diarization options

Research for the map ticket "Local speaker diarization options" (`.scratch/notebook-v1/issues/12-diarization-options.md`). It feeds the grilling ticket "Speaker labels" (13).

Question: what can label who spoke when on the Omarchy machine, how well, at what cost, and how do its turns line up with our Segments and word timings?

**Answer in one line:** use **NVIDIA Nemotron-3-Diarization** on onnxruntime-gpu, which the worker already has, with no torch. Assign a speaker to each word from the model's frame probabilities, and store the speaker per word. On the RTX 3060 it diarizes an hour of audio in about 9 s using 726 MiB of VRAM. It found the right number of speakers on all three tests (3, 3 and 5). Word-level speaker accuracy was 100% on the 4-minute clip, 97.9% on a 55-minute episode and 99.7% on a 91-minute, 5-speaker episode. A third of all Segments contain a speaker change, so a speaker stored per Segment would be wrong a third of the time.

Scripts, logs and samples are in [`diarization-options/`](diarization-options/). All test audio is NASA, US public domain. No media is committed.

## Test material and how it was scored

| Name      | Recording                                                                                                                                                                                                                          | Length  | Speakers                                                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| **clip**  | The segment-shape clip: 10:00–14:00 of HWHAP ep. 209 "Artemis Flight Directors" ([YouTube](https://www.youtube.com/watch?v=ZC4hpgNoumQ))                                                                                           | 4:00    | 3 (host Gary Jordan, Rick LaBrode, Judd Frieling)                          |
| **ep209** | The whole of that episode (YouTube audio)                                                                                                                                                                                          | 55:29   | 3                                                                          |
| **ep283** | HWHAP ep. 283 "The Artemis II Astronauts" ([page](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/the-artemis-ii-astronauts/), [mp3](https://www.nasa.gov/wp-content/uploads/2023/07/ep283_the_artemis_ii_astronauts.mp3)) | 1:30:58 | 5 (host plus Wiseman, Glover, Koch, Hansen, interviewed one after another) |

**Reference.** NASA publishes a transcript with speaker names for every episode. `reflabels.py` aligns that transcript's words to our Parakeet words with `difflib`, using matching blocks of at least 2 words, and copies the speaker across. This labels 83% of ep209's ASR words and 94% of ep283's; the YouTube cut of ep209 differs slightly from the podcast audio. Only the labelled words are scored.

The NASA transcripts are edited: fillers are removed and some backchannels are dropped. So every number below measures how well each word gets the right speaker. None of them is a DER, and missed or false speech is not counted.

**Metrics** (`score.py`):

- **Word accuracy:** the share of words with the right speaker, after the best one-to-one mapping from hypothesis speakers to reference speakers.
- **Speakers:** hypothesis speakers holding at least 1% of words, plus (in brackets) every label that appears at all.
- **Changes within 0.5 s / 1 s:** for each reference speaker change between words, whether the hypothesis changes speaker within that distance.
- **Spurious changes:** hypothesis changes more than 1 s from any reference change. Some of these are real backchannels that the edited transcript leaves out.
- **Short turns:** reference turns of 3 words or fewer ("Yeah.", "Cool.", "Right."), and how many got the right speaker for every word.

ASR: onnx-asr 0.12 with Parakeet TDT 0.6b v3 and tuned Silero VAD, the same as `docs/transcription.md`. Machine: Ryzen 5 5600X (6 cores / 12 threads), RTX 3060 12 GB, onnxruntime-gpu 1.32, torch 2.15+cu132. The voxtype daemon held 3.3 GB of VRAM throughout.

## The options

| Option                                                                                                                                                                   | What it is                                                                                                                                                                                                                                                                                                               | Licence / access                                                                                                                                                                                                                                      | Tested?                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **[nvidia/Nemotron-3-Diarization](https://huggingface.co/nvidia/Nemotron-3-Diarization)** (released 2026-09-23)                                                          | 100M-param end-to-end Sortformer-family model: 31-layer transformer, up to **8 speakers**, 10 ms output, streaming or offline (30.4 s buffer), no length limit with chunked inference                                                                                                                                    | **OpenMDW-1.1**: permissive, "ready for commercial or non-commercial use"; keep the licence and notices when redistributing. **Not gated.**                                                                                                           | **Yes**: three runtimes (our numpy + onnxruntime port, HF transformers 5.24, CPU and CUDA)                                                                                     |
| [nvidia/diar_streaming_sortformer_4spk-v2.1](https://huggingface.co/nvidia/diar_streaming_sortformer_4spk-v2.1)                                                          | The previous NVIDIA model (117M, FastConformer + transformer); **at most 4 speakers**, "performance degrades on recordings with 5 and more speakers"                                                                                                                                                                     | NVIDIA Open Model License; not gated. (v1 is CC-BY-NC-4.0, v2 is CC-BY-4.0.)                                                                                                                                                                          | **Yes**: NeMo 3.0, CPU and CUDA                                                                                                                                                |
| [sherpa-onnx](https://k2-fsa.github.io/sherpa/onnx/speaker-diarization/index.html) 2.0.2 offline speaker diarization                                                     | The pyannote 3.x recipe in C++/ONNX: pyannote segmentation-3.0 (10 s windows), a speaker-embedding model, then "fast" agglomerative clustering with a distance threshold or a fixed speaker count                                                                                                                        | Apache-2.0 library. The segmentation model is an MIT conversion of pyannote/segmentation-3.0, downloaded from k2-fsa's GitHub releases, **ungated**. Embeddings: 3D-Speaker CAM++/ERes2Net, NeMo TitaNet (CC-BY-4.0), WeSpeaker ResNet34 (CC-BY-4.0). | **Yes**: 5 embedding models × 3 thresholds on the clip, 4 configurations on the full episodes, CPU and the CUDA wheel                                                          |
| [pyannote.audio](https://github.com/pyannote/pyannote-audio) 4.1 with [speaker-diarization-community-1](https://huggingface.co/pyannote/speaker-diarization-community-1) | Segmentation, WeSpeaker embedding and VBx clustering; adds "exclusive" (one speaker at a time) output for aligning with ASR                                                                                                                                                                                              | Library MIT; pipeline CC-BY-4.0, but **gated**: you must accept the conditions on HF and use an access token. 3.1 and segmentation-3.0 are gated too.                                                                                                 | **No**: gated, and creating accounts or tokens was off-limits. sherpa-onnx runs the ungated equivalent of the 3.1 recipe (same segmentation model, embedding plus clustering). |
| [DiariZen](https://github.com/BUTSpeechFIT/DiariZen) (BUT)                                                                                                               | pyannote 3.1 with WavLM; the strongest open toolkit in published benchmarks (e.g. AMI-SDM DER 13.9 vs 22.4 for pyannote 3.1)                                                                                                                                                                                             | Code MIT; **weights CC-BY-NC-4.0**, "research and academic purposes"; needs torch 2.1 and its own pyannote checkout                                                                                                                                   | No: non-commercial weights and an old torch stack. Nemotron's model card claims a similar or better DER class (DIHARD III 12.7, AMI SDM 11.1).                                 |
| [MOSS-Transcribe-Diarize 0.9B](https://huggingface.co/OpenMOSS-Team/MOSS-Transcribe-Diarize) (2026-07)                                                                   | Joint ASR plus diarization in one generative model, 50+ languages, up to 90 min                                                                                                                                                                                                                                          | Apache-2.0, not gated                                                                                                                                                                                                                                 | No: it would replace Parakeet and our word timings rather than add to them; out of scope here.                                                                                 |
| onnx-asr `load_vad("onnx-community/pyannote-segmentation-3.0")`                                                                                                          | pyannote segmentation used only as a **VAD**: speech or no speech per 10 s window                                                                                                                                                                                                                                        | MIT, not gated                                                                                                                                                                                                                                        | Not a diarizer: its window-local speaker classes are not linked across windows (`onnx_asr/models/pyannote.py`).                                                                |
| voxtype meeting mode `[meeting.diarization]`                                                                                                                             | `simple`: "Microphone input → You, System loopback → Remote", one label per audio track (`src/meeting/diarization/simple.rs`). `ml`: ECAPA-TDNN embeddings with online centroid clustering (cosine threshold, merge at 0.5), **one speaker per transcript segment**. `hybrid`: mic = You, clustering over loopback only. | MIT                                                                                                                                                                                                                                                   | Not applicable: it labels live mic and loopback capture. It has no file input and cannot split inside a segment.                                                               |

## Results

### Accuracy

Nemotron and Sortformer use per-word probability assignment plus sentence snapping (see Alignment). sherpa-onnx uses its turns with max-overlap assignment.

| System                               |  clip acc | clip spk | ep209 acc | ep209 spk | ep209 changes ≤1 s | ep209 short turns | ep283 acc | ep283 spk | ep283 changes ≤1 s | ep283 short turns |
| ------------------------------------ | --------: | -------: | --------: | --------: | -----------------: | ----------------: | --------: | --------: | -----------------: | ----------------: |
| **Nemotron-3 (ONNX fp32, CUDA)**     | **100.0** |    **3** |  **97.9** | **3** (5) |               84.5 |             12/20 |  **99.7** | **5** (5) |           **91.1** |         **17/26** |
| Nemotron-3 (ONNX int8 step)          |         – |        – |      97.9 |     3 (5) |               84.5 |             12/20 |      99.9 |     5 (5) |               90.6 |             18/26 |
| Nemotron-3 (transformers)            |         – |        3 |      97.9 |     3 (5) |               84.5 |             12/20 |      99.7 |     5 (5) |               90.0 |             16/26 |
| Sortformer 4spk v2.1 (NeMo)          |     100.0 |        3 |      97.6 |     3 (4) |               83.6 |             11/20 |  **64.6** | **4** (4) |               79.4 |             11/26 |
| sherpa-onnx, CAM++ en, threshold 0.9 |      99.0 |        3 |      95.4 |    3 (14) |               67.2 |              3/20 |      91.5 |    6 (25) |               75.6 |              3/26 |
| sherpa-onnx, TitaNet-small, 0.9      |      99.0 |        3 |      95.3 |    3 (14) |               68.1 |              1/20 |      85.0 |    7 (22) |               73.9 |              3/26 |
| sherpa-onnx, TitaNet-small, 0.7      |      98.8 |        3 |      93.4 |    5 (24) |               72.4 |              2/20 |         – |         – |                  – |                 – |
| sherpa-onnx, WeSpeaker ResNet34, 0.5 |      96.5 |        3 |      87.0 |    7 (19) |               73.3 |              2/20 |         – |         – |                  – |                 – |

Reference: the clip has 664 scored words and 8 changes. ep209 has 9150 words, 116 changes and 20 short turns. ep283 has 17,619 words, 180 changes and 26 short turns. Every sherpa run on the clip is in `sherpa-sweep.jsonl`: at threshold 0.5 the five embedding models found 5–12 labels (89.6–96.5%), and TitaNet-large at 0.9 equals TitaNet-small.

Notes on the table:

- The ONNX port matches the transformers reference: 99.98% of thresholded 10 ms frames agree on the clip, and all scores match within 0.1 pt on the episodes.
- Without sentence snapping, Nemotron scores 99.85% on the clip, 97.9% on ep209 and 99.55% on ep283. On ep209, changes within 1 s are then 88.8% instead of 84.5%. Snapping trades a little boundary timing for boundaries that fall on sentence ends; see Alignment.
- Sortformer v2.1 is as good as Nemotron with 3 speakers. With 5 it merges speakers, because it has only 4 output channels: 64.6%.
- sherpa-onnx gets the number of speakers right only with a threshold tuned for the embedding model, and the right threshold differs by model (0.5 suits WeSpeaker, 0.9 suits CAM++). Even then it leaves 10–20 tiny extra clusters, places a third of turn changes more than 1 s off, and almost never labels a backchannel correctly. Its segmentation is `min_duration_on=0.3` s over 10 s windows.

### Speed and memory, CPU vs GPU

The benchmark ran serially with nothing else running (`bench.sh`; raw numbers in `bench.jsonl`). Wall time covers inference only; model load is listed separately. VRAM is the per-process peak from `nvidia-smi`. RTF× is audio duration divided by wall time.

| System                                   | Device              | ep209 (55:29) wall | RTF× | ep283 (1:30:58) wall | RTF× | Peak VRAM               | Peak RSS   | Load      |
| ---------------------------------------- | ------------------- | -----------------: | ---: | -------------------: | ---: | ----------------------- | ---------- | --------- |
| **Nemotron-3, our ONNX port, fp32**      | **CUDA**            |          **8.1 s** |  412 |           **13.1 s** |  416 | **726 MiB** (constant)  | 2.2–2.7 GB | 0.8–1.3 s |
| Nemotron-3, ONNX, int8 step              | CUDA                |             25.7 s |  130 |               68.2 s |   80 | 344 MiB                 | 1.9–2.4 GB | 0.8 s     |
| Nemotron-3, ONNX, fp32                   | CPU                 |             46.9 s |   71 |                    – |    – | –                       | 1.9 GB     | 0.7 s     |
| Nemotron-3, ONNX, int8 step              | CPU                 |             29.8 s |  112 |                    – |    – | –                       | 1.5 GB     | 0.6 s     |
| Nemotron-3, transformers fp32            | CUDA                |              7.2 s |  462 |               11.7 s |  468 | 978 MiB → 1254 MiB      | 3.6–5.3 GB | 1.6–1.9 s |
| Nemotron-3, transformers fp32            | CPU                 |             48.8 s |   68 |                    – |    – | –                       | 3.5 GB     | 1.3 s     |
| Sortformer 4spk v2.1, NeMo               | CUDA                |             12.0 s |  277 |               24.1 s |  226 | 3242 MiB → **4632 MiB** | 2.6–2.8 GB | 1.2 s     |
| Sortformer 4spk v2.1, NeMo               | CPU                 |            100.2 s |   33 |                    – |    – | –                       | 4.0 GB     | 1.1 s     |
| sherpa-onnx, TitaNet-small, 0.9          | CPU, 6 threads      |              226 s |   15 |                    – |    – | –                       | 1.1 GB     | 0.1 s     |
| sherpa-onnx, TitaNet-small, 0.9          | CUDA (2.0.2+cuda12) |              300 s |   11 |                435 s |   13 | 802 MiB                 | 1.8–2.7 GB | 0.3 s     |
| sherpa-onnx, CAM++ en, 0.9               | CPU, 6 threads      |              198 s |   17 |                    – |    – | –                       | 1.1 GB     | 0.1 s     |
| sherpa-onnx, CAM++ en, 0.9               | CUDA (2.0.2+cuda12) |             1422 s |  2.3 |               2600 s |  2.1 | 416 MiB                 | –          | 0.4 s     |
| _for scale: Parakeet ASR (worker today)_ | CUDA                |                  – |    – |                 87 s |   62 | –                       | –          | 0.8 s     |

GPU notes:

- **Nemotron on CUDA works through the worker's own onnxruntime-gpu 1.32**, with the fp32 `step.onnx`. Of the 8.1 s for ep209, 2.5 s is the numpy log-mel front end and 4.0 s is the model plus speaker cache (`profile_nemotron.py`); the rest is reading the WAV and embedding. VRAM stays at 726 MiB whatever the length, because the model runs chunk by chunk. The int8 graph is slower on CUDA (dynamically quantised MatMuls fall back to CPU) and best on CPU only.
- **transformers on CUDA** is about as fast but needs about 3 GB of torch. Its VRAM and RSS grow with length.
- **Sortformer on CUDA** works, but NeMo keeps the whole file's features on the GPU, so VRAM grows with length: 4.6 GB for 91 minutes, alongside voxtype's 3.3 GB.
- **sherpa-onnx's CUDA build** (`sherpa-onnx==2.0.2+cuda12.cudnn9.onnxruntime1.28.2` from k2-fsa's `cuda.html` index) loads on CUDA 13 once pip's CUDA 12 runtime, cuBLAS, cuDNN 9, cuFFT and cuRAND libraries are put on `LD_LIBRARY_PATH`; it uses its own bundled onnxruntime 1.28. It ran on the GPU (802 MiB) but was **no faster than the CPU**. With CAM++ it was 7× slower, probably because the embedding model sees a new input shape for every speech chunk, so CUDA re-plans each time. Rewriting sherpa's pipeline on our onnxruntime-gpu with our own clustering was not worth it given its accuracy.
- **pyannote** was not run. It is gated (see above). With torch it would run on CUDA; its README gives 31 s per hour of audio for community-1 on an H100.

### Failure modes seen

- **Long same-gender monologue given to the other guest** (Nemotron, ep209). One 60-second answer by Rick LaBrode (17:05–18:05, 158 words) went to Judd Frieling. That is 84% of all ep209 errors. Sortformer made the same error. No configuration fixed it. A correction tool ("this paragraph is Rick") is the remedy.
- **A new speaker's first sentences go to the previous guest** (Nemotron, ep283, 1:08:54–1:09:09). Jeremy Hansen's first 10 s after he joined were labelled as Reid Wiseman, and the model caught up after that. This follows from the arrival-order speaker cache.
- **Short backchannels.** Nemotron gets 60–70% of 1–3-word turns ("Yeah.", "Cool.", "Right.", "Got it.") fully right. The misses are mostly attached to the main speaker. sherpa-onnx gets 5–15%.
- **Ghost speakers.** Nemotron opens 2 extra channels on ep209 that hold under 1% of words (for example the cold-open "we have a podcast?" at 0:17). Hide speakers below a floor (1% of words, or under about 10 s in total) or fold them into their neighbours.
- **More than 4 speakers.** Sortformer v2.1 cannot represent a fifth speaker, so ep283 drops to 64.6%. Nemotron's limit is 8; past 8, accuracy should be expected to degrade the same way.
- **Overlap.** Both NVIDIA models output overlapping speakers (several channels above 0.5). Parakeet produces one word stream, so each word gets the single most likely speaker. Crosstalk words go to whoever dominates. The edited reference transcripts can't score overlap.
- **Threshold sensitivity (sherpa-onnx).** The number of speakers is decided by a clustering threshold that depends on the embedding model and the recording (see the accuracy notes). This is the main reason not to use it.

## Aligning turns with Segments and words

The code is in `align.py`, with tests in `test_align.py` (`python test_align.py`; 9 tests, all passing).

1. **A speaker per word, from probabilities** (`assign_words_probs`). The diarizer gives an (N, S) matrix of speaker probabilities, kept every 80 ms. Each word goes to the speaker with the most probability mass over its span.
   - The span is `[start, min(end, start + 0.6 s)]`. Parakeet has no true word end, and `end` is the next word's start, which can include up to 1 s of pause inside a Segment. The cap stops a pause from pulling a word towards the next speaker.
   - A word over near-silence (mean mass below 0.2) is widened by 0.25, 0.5 and then 1 s each side. If the mass is still under 0.05, the word keeps the previous word's speaker.
   - For turn lists (sherpa, or any diarizer without probabilities), `assign_words` does the same by maximum overlap with the turns, falling back to the nearest turn.
   - Probabilities beat thresholded turns: ep283 scores 99.55% from probabilities vs 99.29% from turns, and 90% vs 84% of changes within 1 s.
2. **Snap changes to sentence ends** (`snap_to_sentences`). If a speaker change lands within 3 words of a `.`, `?` or `!`, it moves onto that sentence end. This fixes the most visible reading error, a handover split mid-phrase ("…sheet of music. Got | it."). It took the clip from 99.85% to 100% and ep283 from 99.55% to 99.67%, and cost ep209 0.04 pt. A smoother for one-word flickers (`smooth`) was also tried. It deleted real backchannels (ep283 short turns 17 → 9), so it is not used.
3. **Turn changes inside a Segment** (`speaker_runs`, `speaker_blocks`). **31.6% of ep209's Segments and 32.5% of ep283's** contain a reference speaker change, and 5 of the clip's 15 do (`midseg.py`). The Silero VAD splits on a 1 s silence, and people often hand over faster than that. So the speaker lives on the **word**, and a Segment is cut into speaker runs `{spk, start, end, words: [i0, i1)}` when needed. Segment boundaries and the stored words stay as they are.
4. **Paragraphs** (`labelled_paragraphs`). A new paragraph starts on every speaker change, including mid-Segment. Inside one speaker's block, the segment-shape rules apply unchanged: `segshape.paragraphs` runs over that block's Segment slices, so the pause and length rules see the right gaps.

Sample output: [`diarization-options/nasa-clip.speakers.md`](diarization-options/nasa-clip.speakers.md), with words, runs and paragraphs in `nasa-clip.speakers.json`. Excerpt (fillers stripped; names applied by hand, as the Owner would):

> **Judd Frieling** [0:00] and and and lead. And so that's what we assign that. So cargo missions is another great example. … looking at the same sheet of music.
>
> **Gary Jordan** [0:15] Got it.
>
> **Judd Frieling** [0:16] Essentially.
>
> **Gary Jordan** [0:17] So so Rick, from your lead position of Artemis, what responsibilities as aside from sitting in mission control … what are the lead responsibilities that you're helping out with?
>
> **Rick LaBrode** [0:31] Yeah. I think and this goes for any lead, any lead role. whether it be for an increment, an ISS, or a cargo mission or Artemis, …

The excerpt shows two mid-Segment changes. Segment 0 holds Judd, then Gary's "Got it.", then Judd's "Essentially."; Segment 1 holds Gary's question and the start of Rick's answer.

## Implications for Notebook

- **Recommended approach:** Nemotron-3-Diarization, offline mode, run by `nemotron_onnx.py`. That is about 200 lines of numpy over two ONNX graphs, on the onnxruntime-gpu 1.32 the worker already ships.
  - It adds no torch, no NeMo and no HF token.
  - It handles up to 8 speakers, which covers podcasts, interviews and panels.
  - It finds the number of speakers itself, with no threshold to tune.
  - It needs the files `embed.onnx` (2 MB), `step.onnx` (396 MB), `mel_filters.bin` and `silence_embeds.bin`. Today these come from the unofficial export [NealCaren/Nemotron-3-Diarization-ONNX](https://huggingface.co/NealCaren/Nemotron-3-Diarization-ONNX); its `export_onnx.py` (about 40 lines, needs torch once) can regenerate them from NVIDIA's checkpoint if we'd rather not depend on a third-party export.
  - Licence: OpenMDW-1.1. Keep the licence text next to the model files.
- **Cost per hour of audio** (RTX 3060):
  - About **9 s of GPU time per hour** (8.1 s for 55 min, 13.1 s for 91 min), plus about 1 s for the first model load. That is roughly 15% on top of transcription (Parakeet: about 58 s per hour).
  - **726 MiB of VRAM**, flat. It fits beside Parakeet and voxtype's 3.3 GB.
  - About 2.5 GB of RSS for a 1.5 h file. Most of that is the whole-file log-mel and embeddings, which could be streamed per chunk if it ever matters.
  - CPU fallback: about 32 s per hour with the int8 graph.
  - Cheap enough to run on **every Source** rather than on request. A one-speaker Source just ends up with one speaker, so hide labels when only one speaker holds at least 1% of words.
- **Where it slots in.** In `docs/transcription.md`, add a step between 5 (Transcribe) and 6 (Store), with `transcription.status` moving through `diarizing`:
  1. Run the diarizer on the same `audio.wav` (16 kHz mono, already written by Normalise; `nemotron_onnx.py` reads it with stdlib `wave`). Load the model once at worker start, next to Parakeet.
  2. Turn probabilities into word speakers with `assign_words_probs` and then `snap_to_sentences`, on the words rebuilt by `segshape.words`.
  3. Store `"spk": "S2"` on each word in the Segment's `words` JSON. Add a per-Source speakers map (`S2 → "Rick LaBrode"`, plus hidden or ghost flags) for naming, so a rename applies across the whole Source.
  4. Derive speaker runs and paragraphs at render time (`speaker_blocks` + `segshape.paragraphs`). Nothing else needs storing.
  5. Delete `audio.wav` afterwards, as now.
- **Open for ticket 13 ("Speaker labels"):**
  - Corrections: reassign a paragraph or run, and merge two speakers. These are needed for the 60-second Rick → Judd error, the late pickup of a new speaker, and ghost speakers.
  - Exports: split SRT/VTT cues at speaker changes, with VTT `<v Name>`.
  - Editing: decide what happens to word speakers when Segment text is edited. Word timings are already dropped on edit (ticket 07), so the edited Segment could keep the speaker of its majority, or of each run if it splits.
