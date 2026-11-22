# Segment shape: what onnx-asr + Silero VAD + Parakeet v3 produce

Answers `.scratch/notebook-v1/issues/03-segment-shape.md`. Measured 2026-11-22 on the Owner's machine (RTX 3060 12 GB, about 3.7 GB VRAM already used by other processes) with onnx-asr 0.12.0, onnxruntime-gpu 1.32.0, and the voxtype copy of `nemo-parakeet-tdt-0.6b-v3`.

Sample outputs for the reader prototype are in [`segment-shape/`](segment-shape/). Code and scripts are in the same folder.

## Sources used

| Name        | What                                                                                                                                                                                       | Length | License                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------- |
| **lecture** | MIT 6.006 Spring 2020, Lecture 1 "Algorithms and Computation" (<https://www.youtube.com/watch?v=ZA-tUyM_y7s>). One lecturer, audience questions, long pauses while he writes on the board. | 45:38  | MIT OCW, CC BY-NC-SA   |
| **podcast** | NASA "Houston We Have a Podcast: Artemis Flight Directors" (<https://www.youtube.com/watch?v=ZC4hpgNoumQ>), clip 10:00–14:00. Fast, fluent conversation between three people.              | 4:00   | NASA, US public domain |

Both were fetched with `yt-dlp -x` and converted with `ffmpeg -ar 16000 -ac 1`. The media stayed in a temp dir and is not committed.

## Summary

1. **The onnx-asr defaults are wrong for us. Use `min_silence_duration_ms=1000, speech_pad_ms=100`.** The defaults split at every pause of about 160 ms, which gives tiny Segments (median 1.4 s, 4 words). Parakeet v3 also detects the language per Segment, so it renders 5.6% of the lecture's Segments as phonetic Cyrillic ("А май проблем"). The tuned settings give Segments of about 7 s and 21 words, with no Cyrillic, better punctuation, and a faster run.
2. **Run Silero on the CPU, not CUDA.** It is called once per 32 ms frame, so CUDA launch overhead dominates. VAD alone takes 38 s on CUDA and 14.5 s on CPU for the lecture.
3. **Speed with the recommended settings: 24–33 s for 45:38 of audio, which is 83–115× realtime.** Defaults on CUDA VAD took 48–57 s (48–57×).
4. **Tokens are SentencePiece pieces with `▁` already turned into a leading space.** A token that starts with a space begins a word. Punctuation (`. , ? '`) comes as separate tokens with no space. Times are token _start_ times on an 80 ms grid, relative to the Segment start. `words()` rebuilds words with absolute start and end times.
5. **Word start times are accurate to about one 80 ms frame,** which is enough to seek or highlight the current word. There are no real word end times: onnx-asr throws away the TDT duration output, so a word ends where the next one starts.
6. **Punctuation and casing are good inside a Segment, but there are artifacts at Segment boundaries.** About 72% of Segments end in `.?!`, including some that stop mid-sentence, and the next Segment starts with a capital letter. Longer Segments cut these spurious capitals from 326 to 51 in the lecture.
7. **Fillers make up 1.6% of words in the lecture and 4% in the podcast.** "uh" is about 90% of them. Keep them in storage and strip them when rendering.
8. **Paragraphs should be built from sentences, not whole Segments.** The rules: break on a 1.5 s pause once a paragraph has 30 words, break unconditionally on a pause of 4 s or more, and cap paragraphs at 120 words at a sentence end. That gives a median of 73 words (about 30 s) per paragraph for the lecture and 96–119 words for the podcast.

## 1. Speed (CUDA)

Wall time for `recognize()` over the whole file. The model was already loaded; a warm `load_model` took 0.8 s.

| Config                                                          | Lecture 45:38                        | Podcast 4:00 |
| --------------------------------------------------------------- | ------------------------------------ | ------------ |
| defaults, Silero on CUDA (the setup in `docs/transcription.md`) | 48–57 s (**48–57×**)                 | 5.5 s (43×)  |
| defaults, Silero on CPU                                         | 39 s (70×)                           | n/a          |
| `min_silence 1000, pad 100`, Silero on CPU, batch_size 8        | 24–33 s (**83–115×**)                | 2.6 s (92×)  |
| same with batch_size 16                                         | 24 s (114×)                          | n/a          |
| same with batch_size 32                                         | **OOM** (failed to allocate 2.07 GB) | n/a          |

- Silero VAD alone over the lecture took 38.2 s on CUDA and 14.5 s on CPU. `load_vad()` uses the default providers, which include CUDA. The loop that runs it is in `onnx_asr/models/silero.py:39-64`: one `session.run` per 512-sample hop.
- Longer Segments are faster because there are fewer, larger encoder batches.
- Keep the default `batch_size` of 8. Batch 16 gains little, and 32 fails while voxtype holds its own copy of the model.
- The 10-minute/10 s figure in `docs/transcription.md` matches the defaults, which run at about 55×.

## 2. Segment shape

**Defaults** (`threshold 0.5`, `min_silence 100 ms`, `speech_pad 30 ms`, `max_speech 20 s`):

|                                      | min  | p10  | median | p90  | max  |
| ------------------------------------ | ---- | ---- | ------ | ---- | ---- |
| lecture: duration (s), 1046 Segments | 0.25 | 0.44 | 1.44   | 3.68 | 10.9 |
| lecture: words                       | 1    | 1    | 4      | 13   | 37   |
| lecture: gap to next Segment (s)     | 0.10 | 0.13 | 0.42   | 1.70 | 10.4 |
| podcast: duration (s), 49 Segments   | 0.41 | 0.82 | 3.26   | 9.68 | 15.9 |
| podcast: words                       | 1    | 2    | 8      | 40   | 65   |

In the lecture, 391 of the 1046 Segments (37%) have two words or fewer, and 22 contain nothing but "Uh".

**Recommended** (`min_silence_duration_ms=1000, speech_pad_ms=100`):

|                                     | min   | p10  | median | p90  | max  |
| ----------------------------------- | ----- | ---- | ------ | ---- | ---- |
| lecture: duration (s), 246 Segments | 0.26  | 1.08 | 7.35   | 19.4 | 20.0 |
| lecture: words                      | 0     | 1    | 21     | 55   | 69   |
| lecture: gap to next Segment (s)    | −0.17 | 0.06 | 1.34   | 3.62 | 10.2 |
| podcast: duration (s), 15 Segments  |       |      | 17.0   | 19.3 | 19.7 |
| podcast: words                      |       |      | 51     | 59   |      |

Lecture speech averages 134 words per minute; the podcast averages 186.

### VAD sweep

| Lecture config                         | Segments | median s / words | Cyrillic Segments (seconds) | spurious capital at Segment start¹ | words/sentence | commas/100 words | time  |
| -------------------------------------- | -------- | ---------------- | --------------------------- | ---------------------------------- | -------------- | ---------------- | ----- |
| defaults                               | 1046     | 1.4 / 4          | **59 (103 s)**              | 326                                | 7.9            | 3.7              | 57 s² |
| min_silence 300                        | 667      | 2.0 / 7          | 25 (44 s)                   | 187                                | 9.5            | 5.6              | 49 s² |
| min_silence 500                        | 467      | 2.7 / 8          | 15 (26 s)                   | 120                                | 10.5           | 6.3              | 47 s² |
| min_silence 500, pad 100               | 384      | 3.3 / 9          | 2 (3.5 s)                   | 95                                 | 10.9           | 6.5              | 47 s² |
| min_silence 500, pad 100, max 30 s     | 371      | 3.2 / 9          | 2 (3.5 s)                   | 91                                 | 11.1           | 6.7              | 52 s² |
| **min_silence 1000, pad 100**          | 246      | 7.4 / 21         | **0**                       | **51**                             | **11.5**       | **7.1**          | 24 s  |
| defaults + non-Latin token suppression | 1046     | 1.4 / 4          | 0                           | 322                                | 7.9            | 3.7              | 49 s² |

¹ The previous Segment doesn't end in `.?!` but this one starts with a capital letter, not counting "I". ² Silero on CUDA.

On the podcast, every setting with `min_silence` of 300 ms or more gave 15 Segments, no Cyrillic, and 3–5 spurious capitals, compared with 12 under the defaults.

### VAD options (onnx-asr 0.12.0 source)

You pass these to `model.with_vad(vad, **opts)`. They are typed in `onnx_asr/adapters.py:28-44` (`VadOptions`).

| Option                    | Default          | Where it applies                                                            |
| ------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `threshold`               | 0.5              | `models/silero.py:66-86`: speech starts when the probability is ≥ threshold |
| `neg_threshold`           | threshold − 0.15 | speech ends when the probability is < neg_threshold                         |
| `min_speech_duration_ms`  | 250              | `vad.py:55-82`: drops shorter segments                                      |
| `max_speech_duration_s`   | 20               | stops merging there; a single run of speech longer than this is hard-cut    |
| `min_silence_duration_ms` | 100              | merges neighbouring speech runs whose gap is < this + 2×pad                 |
| `speech_pad_ms`           | 30               | added to each side of the final segment                                     |
| `batch_size`              | 8                | number of Segments per encoder call (`vad.py:95-122`)                       |

Silero frames are 512 samples (32 ms) at 16 kHz.

**How merging works.** `_merge_segments` extends the current segment while the gap is below `min_silence` and the merged length stays under `max_speech`. A large `min_silence` therefore makes Segments grow up to about 20 s, ending at the last pause before the cap. They are still "split where the speaker pauses", as the glossary says.

**Hard cuts.** If one run of speech goes past 20 s without a pause, it is cut at exactly 20 s (`vad.py:79-81`). That happened twice in 45 minutes. The two pieces overlap by up to 0.17 s, which is why the gap minimum is negative, and a word can be garbled at the cut ("the si the the running time…"). This is rare, and raising `max_speech_duration_s` to 30 did not change the counts, so leave it at 20.

### Why longer Segments fix the Cyrillic

Parakeet v3 has no language option: `RecognizeOptions.language` is only used for Whisper and Canary (`adapters.py:47-55`). Its language ID is implicit, so short context lets it drift. 1720 of the 8193 vocabulary pieces contain Cyrillic or Greek letters.

A blunt fallback is to mask those token ids before the argmax. That means wrapping the private `asr._decode` (`models/nemo.py`, `NemoConformerTdt._decode`); see `segment-shape/sweep.py`. With default Segments the mask fixes almost every case, for example "Тен ми трейд план, а не ми гон ексут та план." becomes "Then we train to that plan, and then we go and execute that plan." One Segment came out empty instead.

With the recommended VAD settings the mask changed nothing in either source. So it is optional, a guard if the worker ever sees Cyrillic again, and it is wrong for Ukrainian, Russian, Bulgarian, or Greek Sources (all Parakeet v3 languages). A cheaper option is to flag Segments that contain Cyrillic in an otherwise Latin-script Transcript.

**Drop Segments with empty text before storing them.** One 0.26 s Segment in the lecture had none.

## 3. Tokens to words

Real output (lecture, defaults, Segment at 16.93 s):

```
tokens:     [' My', ' n', 'ame', "'", 's', ' J', 'as', 'on', ' Co', 'o', '.', ' I', "'", 'm', ' going', ...]
timestamps: [0.0, 0.24, 0.32, ...]   # seconds from the Segment start, multiples of 0.08
text:       "My name's Jason Coo. I'm going to be teaching ..."
```

Facts from `onnx_asr/asr.py:109-151`:

- The vocab loader replaces `▁` (U+2581) with `" "`.
- `text` is the joined tokens with the leading space stripped.
- `timestamps = 0.01 s window × 8 subsampling × frame index`, which is **relative to the Segment**. Add `segment.start` to get Source time; the VAD adapter does not (`vad.py:112-114`).
- The decoder records only the frame where each token is emitted (`asr.py:188-229`). The TDT duration head is used only to advance the frame, so tokens have no end times.
- `logprobs` are per token.
- On all 1046 lecture Segments, the first token has a leading space. The only space-less non-alphanumeric tokens are `. ' , ? -`, plus one `<unk>`.

`segment-shape/segshape.py: words(seg)`, which is tested in `segment-shape/test_segshape.py`:

- A token that starts with a space begins a new word. Every other token, including punctuation and `'`, is glued onto the current word.
- `start = segment.start + timestamp of the word's first token`.
- `end` is the next word's start, or `segment.end` for the last word. In-Segment silences are shorter than `min_silence`, so this is close enough.
- `p = exp(mean token logprob)`, a rough confidence: median 1.0, p10 0.86 with tuned VAD. Low `p` picks out misrecognitions such as "thiory" and the Cyrillic fragments.
- The joined words reproduce `seg.text` exactly for every Segment in both sources. This is asserted on real data in the test.

Word durations come out at a median of 0.24 s and a p90 of 0.56 s. Storage for the 45-minute lecture: 6172 words take 204 KB as compact JSON arrays `[w, start, end, p]`, or 365 KB as objects.

**Recommendation for `transcript_segment.words`:** store the rebuilt words `[{w, start, end, p}]` rather than raw tokens. Tokens are not needed after the rebuild, and words are what the reader highlights.

## 4. Timestamp accuracy

Method (`segment-shape/offset.py`): pick random confident words that have a confident predecessor. For each, cut the 16 kHz audio from `start − d` to `start + 2 s` for several offsets d, run the bare model on the clip, and record whether the clip's first recognized word is the target word, the previous word, or something else.

| Cut at       | lecture: target first (n=80) | lecture: previous word first | podcast: target first (n=40) | podcast: previous word first |
| ------------ | ---------------------------- | ---------------------------- | ---------------------------- | ---------------------------- |
| start + 0.16 | 21                           | 2                            | 13                           | 1                            |
| start + 0.08 | **45**                       | 5                            | 20                           | 3                            |
| start        | **41**                       | 9                            | **21**                       | 6                            |
| start − 0.08 | 31                           | 17                           | 12                           | 12                           |
| start − 0.16 | 18                           | 29                           | 7                            | 18                           |
| start − 0.32 | 6                            | 24                           | 4                            | 17                           |

The target is recognized most often when the cut is at the reported start or 80 ms after it. Cutting 80 ms earlier already pulls in the previous word. Cutting 160 ms late loses the word's onset. So **reported word starts sit within about one 80 ms frame of the true onset.** Seeking playback to `word.start` is correct; no offset is needed.

The "other" results, 30–50%, are clips the model mis-hears without context; they say nothing about the timestamps. An earlier, simpler test that recognized `[start, end]` in isolation got only 7 of 20 right, because sub-second clips without context confuse the model, so it is not a usable oracle.

## 5. Punctuation and casing

- Inside Segments it is good: sentence casing, `? , . '`, contractions, and questions punctuated correctly ("What is a problem? What is an algorithm?").
- Commas are sparse with short Segments, at 3.7 per 100 words. With longer Segments that rises to 7.1 per 100 words and to 11.5 words per sentence.
- The model treats every Segment as a complete utterance. It puts a period at the end of a Segment even mid-sentence ("solve computational. Problems.") and capitalizes the first word of the next Segment ("If I have maintained this | Then if I replace K"). Longer Segments reduce this sharply; see the sweep table. Don't try to repair it with rules, because there is no reliable way to tell proper nouns apart.
- Proper nouns are hit or miss: "Eric Domain" for Erik Demaine. "Jason Ku" is correct with tuned VAD but comes out as "Jason Coo" with the defaults.
- Words the lecturer says while writing on the board come out as capitalized fragments ("Prove Correctness. Argue Efficiency.").
- Disfluent repeats are kept, with 65 repeated-word pairs in the lecture ("the the", "is is"). Leave them.

## 6. Filler words

|                    | uh  | um  | ah / mm | per 1000 words | filler-only Segments |
| ------------------ | --- | --- | ------- | -------------- | -------------------- |
| lecture (defaults) | 93  | 3   | 3       | 16             | 22 of 1046           |
| podcast (defaults) | 22  | 8   | 0       | 40             | 3 of 49              |

Tuned VAD recovers a few more: 112 uh/um in the lecture and 32 in the podcast. Parakeet transcribes fillers literally, as "uh", "Uh,", or "um". "You know" and "like" are real words and should stay.

**Recommendation:** keep fillers in the stored Segments and words. They hold timing and make the text faithful. Strip them when rendering the reader view and Exports, with a toggle if one is wanted.

`strip_fillers(text)` in `segshape.py` removes `uh`, `um`, `er`, `ah`, `hmm`, `mm`, and `erm`. It also moves a sentence-ending mark from the filler to the previous word and capitalizes the next word when the filler started a sentence ("Uh Eric Domain…" becomes "Eric Domain…"; "It works. Um, so yes" becomes "It works. So yes"). The filler-only "Uh" Segments disappear.

## 7. Paragraph rules (proposal)

Segments are too coarse for paragraphs. With tuned VAD they run up to 20 s and 60 words, and fluent conversation has no pause of 1 s or more (podcast gap p90 0.5 s). So **compute paragraphs from sentences rebuilt from the word stream**, letting a paragraph break inside a Segment.

Paragraphs are a derived view: a pure function of the Segments' words, with nothing new stored. It is implemented as `sentences()` and `paragraphs()` in `segshape.py` and covered by `test_segshape.py`.

1. **Sentence:** words up to one ending in `.`, `?`, or `!`. A sentence may span Segments. A sentence that starts a Segment carries `gap_before` = silence since the previous Segment. Any other sentence has a gap of 0, because pauses inside a Segment are under 1 s.
2. Start a **new paragraph** before a sentence when any of these hold:
   - `gap_before ≥ 4 s`: a topic change or a long pause;
   - `gap_before ≥ 1.5 s` **and** the paragraph already has 30 or more words;
   - adding the sentence would pass **120 words** and the paragraph has 30 or more words;
   - the paragraph has reached **200 words**. For unpunctuated run-on speech, `sentences()` also closes a sentence at a Segment boundary once it reaches 200 words.
3. Each paragraph keeps `start` (its first word's time, for a `[m:ss]` link) and `at = [segment idx, word idx]`, so the reader can map it back to Segments and words.
4. Render with `strip_fillers()`, and skip any paragraph that ends up empty.

Results with these defaults:

|                      | paragraphs | words min / median / p90 / max | median duration |
| -------------------- | ---------- | ------------------------------ | --------------- |
| lecture, tuned VAD   | 86         | 1 / 73 / 116 / 120             | 30 s            |
| lecture, default VAD | 87         | 1 / 71 / 117 / 120             | 29 s            |
| podcast, tuned VAD   | 7          | 96 / 110 / 117 / 119           | 34 s            |

The rules give nearly the same paragraphs whether or not VAD is tuned, so paragraphing does not depend on the VAD choice.

The 9 lecture paragraphs under 15 words fall between board-writing pauses of 4 s or more ("So what's my base case here?"); that is acceptable. A pause threshold of 1.0 s gave 88 paragraphs with a median of 56 words, and 2.0 s gave 59 with a median of 106, so 1.5 s sits in the middle.

**Known limit:** in fast conversation, paragraphs break only on the word cap, not at speaker turns. Speaker labels (a ticket still waiting in the map) would add the obvious rule "new paragraph on speaker change".

Sample, lecture 1:00–2:26, from `segment-shape/mit-6006-lecture1.md`:

> **[1:00]** Really, what the course is about is teaching you to solve computational problems. But it's more than that. It's not just about teaching you to solve computational problems. So solve goal.
>
> **[1:16]** One, solve computational. Problems. But it's more than that. It's also about communicating those solutions to others and being able to communicate that your way of solving the problem is correct and efficient. Okay? So it's about Two more things. Prove Correctness.
>
> **[1:53]** Argue Efficiency. And in general, it's about Communication, communication, I can't spell by the way. Communication of these ideas. …

## 8. Recommended worker settings

```python
vad = onnx_asr.load_vad("silero", providers=["CPUExecutionProvider"])
model = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3", STT_MODEL_DIR, providers=STT_PROVIDERS)
asr = model.with_vad(vad, min_silence_duration_ms=1000, speech_pad_ms=100).with_timestamps()  # batch_size 8
for seg in asr.recognize(wav):
    if seg.text.strip():
        store(seg.start, seg.end, seg.text, words(seg))  # words: [{w, start, end, p}]
```

Optional: flag, or suppress, Cyrillic output when the Source is expected to be in a Latin-script language.

## Files in `segment-shape/`

| File                                               | Contents                                                                                                                                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mit-6006-lecture1.json` / `.md`                   | Lecture 0:00–10:00 with tuned VAD: 46 Segments with words, plus paragraph boundaries; the Markdown rendering has fillers stripped                                                      |
| `mit-6006-lecture1.default-vad.json` / `.md`       | The same 10 minutes with the defaults (220 Segments) for comparison. Contains Cyrillic misfires.                                                                                       |
| `nasa-hwhap-artemis-flight-directors.json` / `.md` | The 4-minute podcast clip with tuned VAD (15 Segments, 7 paragraphs). Times are relative to the clip; add 600 s for episode time.                                                      |
| `segshape.py`, `test_segshape.py`                  | `words()`, `strip_fillers()`, `sentences()`, `paragraphs()` and their tests. Run with `uv run --no-project --with pytest python -m pytest -p no:cacheprovider research/segment-shape`. |
| `sweep.py`, `offset.py`                            | The VAD and suppression sweep, and the timestamp offset check. They need the onnx-asr environment and the wav files.                                                                   |

JSON shape: `{source, transcription: {model, vad_kwargs, ...}, paragraphs: [{start, end, at}], segments: [{idx, start, end, text, words: [{w, start, end, p}]}]}`.
