"""Render a speaker-labelled sample: Segments (segment-shape JSON with words) +
diarizer speaker probabilities (npz "p80", 80 ms rows) -> per-word speakers,
speaker runs per Segment, and speaker-labelled paragraphs.

usage: render.py segments.json diar.npz out_prefix 'S1=Name,S2=Name' [offset_s]

offset_s: time of the Segments' t=0 within the diarized audio (0 when the same
file was diarized).
"""
import json, sys
import numpy as np

from align import assign_words_probs, labelled_paragraphs, snap_to_sentences, speaker_runs
from segshape import strip_fillers, ts

segp, npz, prefix, names_s = sys.argv[1:5]
off = float(sys.argv[5]) if len(sys.argv) > 5 else 0.0
names = dict(kv.split("=") for kv in names_s.split(",")) if names_s else {}
d = json.load(open(segp))
p = np.load(npz)["p80"].astype(np.float32)

segs = d["segments"]
all_words = [w for s in segs for w in s["words"]]
labelled = iter(snap_to_sentences(assign_words_probs(all_words, p, offset=-off)))
for s in segs:
    s["words"] = [next(labelled) for _ in s["words"]]
    s["runs"] = [{"spk": r["spk"], "start": r["start"], "end": r["end"], "words": [r["i0"], r["i1"]]}
                 for r in speaker_runs(s["words"])]
paras = labelled_paragraphs(segs, names)

json.dump({"source": d["source"], "diarization": {"model": "nvidia/Nemotron-3-Diarization (ONNX, offline)",
                                                  "assignment": "align.assign_words_probs + align.snap_to_sentences", "names": names},
           "segments": [{k: s[k] for k in ("idx", "start", "end", "text", "words", "runs")} for s in segs],
           "paragraphs": [{k: p[k] for k in ("spk", "start", "end", "at")} for p in paras]},
          open(prefix + ".json", "w"), indent=1, ensure_ascii=False)

src = d["source"]
mid = [s for s in segs if len(s["runs"]) > 1]
with open(prefix + ".md", "w") as f:
    f.write(f"# {src['title']} (speaker-labelled)\n\n<{src['url']}> ({src['license']}). {src['note']}\n\n")
    f.write("Speakers from Nemotron-3-Diarization (ONNX, offline mode), one per word by probability mass "
            "(`align.assign_words_probs`), with a change within 3 words of a sentence end moved onto it (`align.snap_to_sentences`); a new paragraph on every speaker change, even inside a Segment, "
            "and the segment-shape paragraph rules within a speaker; fillers stripped. Speaker names were "
            "applied by hand (as the Owner would), from the NASA transcript.\n\n")
    for p_ in paras:
        f.write(f"**{p_['spk']}** [{ts(p_['start'])}] {strip_fillers(p_['text'])}\n\n")
    f.write(f"## Segments with a turn change inside ({len(mid)} of {len(segs)})\n\n")
    for s in mid:
        parts = [f"{names.get(r['spk'], r['spk'])} {r['start']:.2f}-{r['end']:.2f}: \""
                 + " ".join(w["w"] for w in s["words"][r["words"][0]:r["words"][1]]) + "\"" for r in s["runs"]]
        f.write(f"- Segment {s['idx']} ({s['start']:.2f}-{s['end']:.2f} s): " + " | ".join(parts) + "\n")
print(prefix, "paragraphs", len(paras), "segments with turn change", len(mid), "of", len(segs))
