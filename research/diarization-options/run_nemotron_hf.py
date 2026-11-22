"""NVIDIA Nemotron-3-Diarization through Hugging Face transformers (PyTorch), offline mode.

usage: run_nemotron_hf.py in.wav out.json [cuda|cpu] [fp32|bf16]

Writes two turn sets: "turns" (the processor's own extract_speaker_dict, which
may overlap) and "turns_exclusive" (one speaker per 10 ms frame: the most likely
speaker among those over 0.5), plus 80 ms speaker probabilities in out.npz.
"""
import json, sys, time
import numpy as np
import soundfile as sf
import torch
from transformers import AutoModelForAudioFrameClassification, AutoProcessor

from meter import Meter

wav, out = sys.argv[1:3]
dev = sys.argv[3] if len(sys.argv) > 3 else "cuda"
dt = {"fp32": torch.float32, "bf16": torch.bfloat16}[sys.argv[4] if len(sys.argv) > 4 else "fp32"]
mid = "nvidia/Nemotron-3-Diarization"

with Meter() as m:
    t0 = time.perf_counter()
    proc = AutoProcessor.from_pretrained(mid)
    model = AutoModelForAudioFrameClassification.from_pretrained(mid, dtype=dt).to(dev).eval()
    if dev == "cuda":
        torch.cuda.synchronize()
    t1 = time.perf_counter()
    audio, sr = sf.read(wav, dtype="float32")
    inputs = proc(audio, sampling_rate=sr).to(dev, dtype=dt)
    with torch.inference_mode():
        logits = model(**inputs).logits
    if dev == "cuda":
        torch.cuda.synchronize()
    t2 = time.perf_counter()
    segs = proc.extract_speaker_dict(logits, inputs.attention_mask)[0]
    t3 = time.perf_counter()

p = torch.sigmoid(logits[0].float()).cpu().numpy()  # (T, 8), 10 ms frames
turns = [{"start": round(float(s["Start"]), 3), "end": round(float(s["End"]), 3),
          "speaker": f"S{int(s['Speaker'])}"} for s in segs]


def exclusive(p, thr=0.5, hop=0.01, min_on=0.3):
    lab = np.where(p.max(1) > thr, p.argmax(1), -1)
    out, i = [], 0
    while i < len(lab):
        j = i
        while j + 1 < len(lab) and lab[j + 1] == lab[i]:
            j += 1
        if lab[i] >= 0 and (j - i + 1) * hop >= min_on:
            out.append({"start": round(i * hop, 3), "end": round((j + 1) * hop, 3), "speaker": f"S{lab[i]}"})
        i = j + 1
    return out


dur = len(audio) / sr
meta = {"system": "nemotron-3-diarization (transformers)", "device": dev, "dtype": str(dt).split(".")[-1],
        "audio_s": round(dur, 1), "load_s": round(t1 - t0, 2), "wall_s": round(t2 - t1, 2),
        "post_s": round(t3 - t2, 2), "rtfx": round(dur / (t2 - t1), 1), "vram_mib": m.peak_mib,
        "torch_peak_alloc_mib": (torch.cuda.max_memory_allocated() // 2**20) if dev == "cuda" else 0,
        "rss_mib": Meter.rss_mib(), "n_turns": len(turns),
        "speakers_active": int((p > 0.5).any(0).sum())}
print(json.dumps(meta))
json.dump({"meta": meta, "turns": turns, "turns_exclusive": exclusive(p)}, open(out, "w"))
np.savez_compressed(out.replace(".json", ".npz"), p80=p[::8].astype(np.float16))
