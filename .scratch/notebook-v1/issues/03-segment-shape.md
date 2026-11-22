# What onnx-asr output looks like as readable text

Type: research
Status: open
Blocked by:

## Question

On real speech (a ~30–60 min talk or podcast and a short clip), what does onnx-asr + Silero VAD + Parakeet v3 actually produce? Report: the distribution of Segment lengths, punctuation and casing quality, how tokens map to words (rebuilding words and word times from subword tokens), timestamp accuracy against the audio, and filler words ("uh", "um"). Then: what simple rules would turn Segments into readable paragraphs (pause length, sentence ends, max length), and do VAD settings need tuning? Capture sample outputs as files for the reader prototype.
