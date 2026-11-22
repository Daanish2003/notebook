"""List words whose speaker disagrees with the reference, grouped into runs.

usage: errors.py ref.json hyp.json [--probs] [--offset=S] [t0 t1]
"""
import collections, json, sys

from align import assign_words, assign_words_probs
from score import best_map

args = [a for a in sys.argv[1:] if not a.startswith("--")]
off = next((float(a.split("=")[1]) for a in sys.argv if a.startswith("--offset=")), 0.0)
ref = json.load(open(args[0]))["words"]
if len(args) > 2:
    ref = [w for w in ref if float(args[2]) <= w["start"] < float(args[3])]
hyp = json.load(open(args[1]))
if "--probs" in sys.argv:
    import numpy as np
    H = assign_words_probs(ref, np.load(args[1].replace(".json", ".npz"))["p80"].astype("float32"), offset=off)
else:
    H = assign_words(ref, [{**t, "start": t["start"] + off, "end": t["end"] + off} for t in hyp["turns"]])
pairs = [(h["spk"], w["spk"]) for h, w in zip(H, ref) if w["spk"]]
hs = [h for h, c in collections.Counter(h for h, _ in pairs).most_common(8)]
m = best_map(pairs, hs, sorted({r for _, r in pairs}))
err = [(w["start"], w["w"], w["spk"], m.get(h["spk"], h["spk"])) for w, h in zip(ref, H)
       if w["spk"] and m.get(h["spk"]) != w["spk"]]
print("errors", len(err), "of", len(pairs))
print(collections.Counter((e[2], e[3]) for e in err).most_common(10))
runs = []
for e in err:
    if runs and e[0] - runs[-1][-1][0] < 3:
        runs[-1].append(e)
    else:
        runs.append([e])
runs.sort(key=len, reverse=True)
for r in runs[:15]:
    print(f"{r[0][0]:.1f}-{r[-1][0]:.1f} n={len(r)} {r[0][2].split()[0]}->{r[0][3].split()[0]}: "
          + " ".join(e[1] for e in r[:25]))
print("single-word error runs:", sum(len(r) == 1 for r in runs), "runs total", len(runs))
