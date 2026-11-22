"""How often does a speaker change fall inside a Segment?

usage: midseg.py ref.json diar.json   (diar.npz next to diar.json)

Counts, over the whole file, Segments whose words get more than one speaker
(reference labels, and Nemotron + assign_words_probs + snap_to_sentences).
"""
import json, sys
import numpy as np

from align import assign_words_probs, snap_to_sentences

ref = json.load(open(sys.argv[1]))["words"]
p = np.load(sys.argv[2].replace(".json", ".npz"))["p80"].astype(np.float32)
H = snap_to_sentences(assign_words_probs(ref, p))
by_seg = {}
for w, h in zip(ref, H):
    by_seg.setdefault(w["seg"], []).append((w["spk"], h["spk"]))
n = len(by_seg)
ref_multi = sum(1 for v in by_seg.values() if len({r for r, _ in v if r}) > 1)
hyp_multi = sum(1 for v in by_seg.values() if len({h for _, h in v}) > 1)
print(json.dumps({"segments": n, "ref_multi_speaker_segments": ref_multi, "hyp_multi_speaker_segments": hyp_multi,
                  "ref_share": round(ref_multi / n, 3), "hyp_share": round(hyp_multi / n, 3)}))
