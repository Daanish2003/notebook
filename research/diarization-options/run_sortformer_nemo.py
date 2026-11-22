"""NVIDIA Streaming Sortformer 4spk v2.1 through NeMo, offline-style (30.4 s buffer).

usage: run_sortformer_nemo.py in.wav out.json [cuda|cpu] [model_id]
"""
import json, sys, time
import numpy as np
import soundfile as sf
import torch
from nemo.collections.asr.models import SortformerEncLabelModel

from meter import Meter

wav, out = sys.argv[1:3]
dev = sys.argv[3] if len(sys.argv) > 3 else "cuda"
mid = sys.argv[4] if len(sys.argv) > 4 else "nvidia/diar_streaming_sortformer_4spk-v2.1"
with Meter() as m:
    t0 = time.perf_counter()
    model = SortformerEncLabelModel.from_pretrained(mid, map_location=dev).eval()
    # model-card "very high latency" config
    mod = model.sortformer_modules
    mod.chunk_len, mod.chunk_right_context, mod.fifo_len, mod.spkcache_update_period = 340, 40, 40, 300
    mod.spkcache_len = 188
    mod._check_streaming_parameters()
    t1 = time.perf_counter()
    segs, probs = model.diarize(audio=[wav], batch_size=1, include_tensor_outputs=True)
    if dev == "cuda":
        torch.cuda.synchronize()
    t2 = time.perf_counter()
turns = []
for s in segs[0]:
    a, b, spk = s.split() if isinstance(s, str) else s
    turns.append({"start": float(a), "end": float(b), "speaker": f"S{str(spk).split('_')[-1]}"})
p = probs[0].squeeze(0).float().cpu().numpy()  # (T, 4) at 80 ms
dur = sf.info(wav).duration
meta = {"system": "sortformer-4spk-v2.1 (nemo)", "audio_s": round(dur, 1), "load_s": round(t1 - t0, 2),
        "wall_s": round(t2 - t1, 2), "rtfx": round(dur / (t2 - t1), 1), "vram_mib": m.peak_mib,
        "device": dev, "torch_peak_alloc_mib": (torch.cuda.max_memory_allocated() // 2**20) if dev == "cuda" else 0, "rss_mib": Meter.rss_mib(),
        "speakers_active": int((p > 0.5).any(0).sum()), "frames": list(p.shape)}
print(json.dumps(meta))
json.dump({"meta": meta, "turns": turns}, open(out, "w"))
np.savez_compressed(out.replace(".json", ".npz"), p80=p.astype(np.float16))
