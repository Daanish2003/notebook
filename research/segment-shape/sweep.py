"""Sweep VAD options (and optional non-Latin token suppression) on one wav."""
import json, os, re, sys, time
import numpy as np
import onnx_asr

P = os.path.expanduser("~/.local/share/voxtype/models/parakeet-tdt-0.6b-v3")
wav = sys.argv[1]
outdir = sys.argv[2]
os.makedirs(outdir, exist_ok=True)
base = onnx_asr.load_model("nemo-parakeet-tdt-0.6b-v3", P,
                           providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
vad = onnx_asr.load_vad("silero", providers=["CPUExecutionProvider"])
asr = base.asr
orig_decode = asr._decode
# vocab ids whose text contains a letter outside Latin script (Cyrillic, Greek)
bad = np.array([i for i, t in asr._vocab.items() if re.search(r"[Ͱ-ϿЀ-ӿ]", t)])
print("vocab", len(asr._vocab), "non-Latin-script ids", len(bad))
SUPPRESS = False


def decode(*a):
    logits, step, state = orig_decode(*a)
    if SUPPRESS:
        logits = logits.copy()
        logits[bad] = -np.inf
    return logits, step, state


asr._decode = decode

CONFIGS = {
    "default": {},
    "sil300": {"min_silence_duration_ms": 300},
    "sil500": {"min_silence_duration_ms": 500},
    "sil500_pad100": {"min_silence_duration_ms": 500, "speech_pad_ms": 100},
    "sil1000_pad100": {"min_silence_duration_ms": 1000, "speech_pad_ms": 100},
    "sil500_pad100_max30": {"min_silence_duration_ms": 500, "speech_pad_ms": 100, "max_speech_duration_s": 30},
    "default+suppress": {},
    "sil1000_pad100+suppress": {"min_silence_duration_ms": 1000, "speech_pad_ms": 100},
    "sil500_pad100+suppress": {"min_silence_duration_ms": 500, "speech_pad_ms": 100},
}
only = sys.argv[3].split(",") if len(sys.argv) > 3 else list(CONFIGS)
for name in only:
    kw = CONFIGS[name]
    SUPPRESS = name.endswith("+suppress")
    t = time.perf_counter()
    segs = [dict(start=s.start, end=s.end, text=s.text, tokens=s.tokens, timestamps=s.timestamps,
                 logprobs=s.logprobs) for s in base.with_vad(vad, **kw).with_timestamps().recognize(wav)]
    el = time.perf_counter() - t
    dur = np.array([s["end"] - s["start"] for s in segs])
    wc = np.array([len(s["text"].split()) for s in segs])
    cy = [s for s in segs if re.search(r"[Ѐ-ӿ]", s["text"])]
    nw = int(wc.sum())
    fill = sum(1 for s in segs for w in s["text"].split() if re.sub(r"[^\w]", "", w).lower() in ("uh", "um"))
    row = dict(cfg=name, secs=round(el, 1), n=len(segs), dur_med=round(float(np.median(dur)), 2),
               dur_p90=round(float(np.percentile(dur, 90)), 2), dur_max=round(float(dur.max()), 2),
               words_med=int(np.median(wc)), words_p90=int(np.percentile(wc, 90)), words=nw,
               cyr_segs=len(cy), cyr_s=round(sum(s["end"] - s["start"] for s in cy), 1), uh_um=fill,
               at_cap=int((dur >= kw.get("max_speech_duration_s", 20) - 0.1).sum()))
    print(json.dumps(row), flush=True)
    json.dump(dict(meta=dict(cfg=name, vad_kwargs=kw, suppress=SUPPRESS, secs=el), segments=segs),
              open(f"{outdir}/{name}.json", "w"))
