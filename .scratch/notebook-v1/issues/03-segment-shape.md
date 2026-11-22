# What onnx-asr output looks like as readable text

Type: research
Status: resolved
Blocked by:

## Question

On real speech (a ~30–60 min talk or podcast and a short clip), what does onnx-asr + Silero VAD + Parakeet v3 actually produce? Report: the distribution of Segment lengths, punctuation and casing quality, how tokens map to words (rebuilding words and word times from subword tokens), timestamp accuracy against the audio, and filler words ("uh", "um"). Then: what simple rules would turn Segments into readable paragraphs (pause length, sentence ends, max length), and do VAD settings need tuning? Capture sample outputs as files for the reader prototype.

## Answer

Research: [`research/segment-shape.md` on branch `research/segment-shape`](https://github.com/Daanish2003/notebook/blob/research/segment-shape/research/segment-shape.md). Includes samples (MIT 6.006 lecture, NASA podcast), `segshape.py` with tests, and the VAD sweep.

- **Tune the VAD:** `with_vad(vad, min_silence_duration_ms=1000, speech_pad_ms=100)`.
  - The defaults split at about 160 ms pauses: 1046 Segments in 45 min, median 4 words, 37% of them two words or fewer.
  - On those short Segments Parakeet drifts into phonetic Cyrillic (5.6% of the lecture).
  - With the tuned settings: 246 Segments (median 7.4 s / 21 words, max 20 s, the VAD's hard cap), zero Cyrillic, far fewer spurious capitals, better punctuation and names.
  - Masking Cyrillic/Greek tokens is an optional extra guard. It would break Cyrillic-script Sources, which are out of scope anyway.
- **Speed:** run Silero VAD on CPU and Parakeet on CUDA: 45 min of audio in 24–33 s. VAD on CUDA is slower. Keep batch size 8; 32 runs out of memory.
- **Tokens and timing:** tokens are SentencePiece pieces with a leading space marking a word start. Timestamps are token starts on an 80 ms grid, accurate to about one frame, so seeking to `word.start` is exact. There are no true word end times; a word's `end` is the next word's start. `words(seg)` rebuilds the Segment text exactly.
- **Text quality:** punctuation and casing are good within a Segment. A Segment boundary can add a period and a capital mid-sentence. Proper names are often wrong, which is a case for in-place editing.
- **Fillers** ("uh" is about 90% of them): 16 to 40 per 1000 words. Keep them in storage and strip them when rendering (`strip_fillers()` repairs commas and capitals).
- **Paragraph rules:** computed from sentences rebuilt from words, so a paragraph can break inside a Segment, and nothing extra is stored. Start a new paragraph before a sentence when:
  1. the pause before it is 4 s or more;
  2. the pause is 1.5 s or more and the paragraph already has 30 or more words;
  3. adding the sentence would pass 120 words and the paragraph has 30 or more;
  4. the paragraph has reached 200 words.

  The lecture gives a median of 73 words (about 30 s) per paragraph.
