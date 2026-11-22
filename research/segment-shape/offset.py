"""Estimate word-start bias: re-recognize audio from (start - d) to start+2s for several d
and record whether the clip's first word is the target word (onset intact) or the
previous word (cut is too early). Prints the per-d hit rate.
"""
import json, os, random, re, sys, wave
import numpy as np
import onnx_asr
from segshape import words

P = os.path.expanduser("~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3")
wav, js, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
with wave.open(wav) as w:
    audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
SR = 16000
m = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3", P, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
norm = lambda t: re.sub(r"[^a-z' ]", "", t.lower()).split()
cands = []
for s in json.load(open(js))["segments"]:
    ws = words(s)
    for a, b in zip(ws, ws[1:]):
        # target word b with a real predecessor a in the same segment, both confident, distinct
        if (re.fullmatch(r"[A-Za-z]{3,}[.,?]?", b["w"]) and re.fullmatch(r"[A-Za-z']{2,}[.,?]?", a["w"])
                and a["p"] > 0.9 and b["p"] > 0.9 and norm(a["w"]) != norm(b["w"]) and not norm(b["w"])[0] in ("uh", "um")):
            cands.append((a, b))
random.seed(11)
D = [-0.16, -0.08, 0.0, 0.08, 0.16, 0.24, 0.32]
hits = {d: [0, 0, 0] for d in D}  # target first, prev first, other
for a, b in random.sample(cands, n):
    t, p = norm(b["w"])[0], norm(a["w"])[0]
    for d in D:
        clip = audio[int((b["start"] - d) * SR):int((b["start"] + 2.0) * SR)]
        first = norm(m.recognize(np.pad(clip, (1600, 0)), sample_rate=SR))[:1]
        hits[d][0 if first == [t] else 1 if first == [p] else 2] += 1
for d in D:
    h = hits[d]
    print(f"cut at start-{d:+.2f}s: first word = target {h[0]}/{n}, = previous word {h[1]}/{n}, other {h[2]}/{n}")
