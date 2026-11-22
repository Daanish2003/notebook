"""sherpa-onnx offline speaker diarization (pyannote segmentation-3.0 ONNX + speaker
embedding + fast agglomerative clustering).

usage: run_sherpa.py MODEL_DIR in.wav out.json EMBEDDING [threshold|n=K] [threads] [provider] [seg]
"""
import json, sys, time
import numpy as np
import sherpa_onnx
import soundfile as sf

from meter import Meter

mdir, wav, out, emb = sys.argv[1:5]
clu = sys.argv[5] if len(sys.argv) > 5 else "0.5"
threads = int(sys.argv[6]) if len(sys.argv) > 6 else 6
provider = sys.argv[7] if len(sys.argv) > 7 else "cpu"
seg = sys.argv[8] if len(sys.argv) > 8 else "sherpa-onnx-pyannote-segmentation-3-0/model.onnx"
num_clusters, threshold = (int(clu[2:]), 0.5) if clu.startswith("n=") else (-1, float(clu))

cfg = sherpa_onnx.OfflineSpeakerDiarizationConfig(
    segmentation=sherpa_onnx.OfflineSpeakerSegmentationModelConfig(
        pyannote=sherpa_onnx.OfflineSpeakerSegmentationPyannoteModelConfig(model=f"{mdir}/{seg}"),
        num_threads=threads, provider=provider),
    embedding=sherpa_onnx.SpeakerEmbeddingExtractorConfig(model=f"{mdir}/{emb}", num_threads=threads,
                                                          provider=provider),
    clustering=sherpa_onnx.FastClusteringConfig(num_clusters=num_clusters, threshold=threshold),
    min_duration_on=0.3, min_duration_off=0.5)
assert cfg.validate()
with Meter() as m:
    t0 = time.perf_counter()
    sd = sherpa_onnx.OfflineSpeakerDiarization(cfg)
    t1 = time.perf_counter()
    audio, sr = sf.read(wav, dtype="float32", always_2d=True)
    audio = audio[:, 0]
    assert sr == sd.sample_rate
    res = sd.process(audio).sort_by_start_time()
    t2 = time.perf_counter()
turns = [{"start": round(r.start, 3), "end": round(r.end, 3), "speaker": f"S{r.speaker}"} for r in res]
dur = len(audio) / sr
meta = {"system": "sherpa-onnx", "embedding": emb, "clustering": clu, "threads": threads,
        "provider": provider, "seg": seg, "audio_s": round(dur, 1), "load_s": round(t1 - t0, 2),
        "wall_s": round(t2 - t1, 2), "rtfx": round(dur / (t2 - t1), 1), "vram_mib": m.peak_mib,
        "rss_mib": Meter.rss_mib(), "n_turns": len(turns)}
print(json.dumps(meta))
json.dump({"meta": meta, "turns": turns}, open(out, "w"))
