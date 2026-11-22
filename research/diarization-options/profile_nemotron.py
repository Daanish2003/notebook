"""Split Nemotron ONNX wall time into log-mel (numpy), embed and chunk steps.

usage: profile_nemotron.py MODEL_DIR in.wav [cuda|cpu]
"""
import sys, time, wave
import numpy as np

import nemotron_onnx as N

mdir, wav = sys.argv[1:3]
prov = sys.argv[3] if len(sys.argv) > 3 else "cuda"
with wave.open(wav) as w:
    audio = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768.0
d = N.Diarizer(mdir, prov)
t0 = time.perf_counter()
feats = N.log_mel(audio, d.filters)
t1 = time.perf_counter()
p = d(audio)  # includes mel again
t2 = time.perf_counter()
print(f"audio {len(audio) / 16000:.0f} s: log-mel {t1 - t0:.2f} s, full run {t2 - t1:.2f} s "
      f"(model + cache {t2 - t1 - (t1 - t0):.2f} s)")
