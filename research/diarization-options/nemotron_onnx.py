"""Nemotron-3-Diarization in numpy + onnxruntime (no torch), offline mode.

A Python port of the offline path of transformers'
Nemotron3DiarizationForAudioFrameClassification, following the structure of
nealcaren/local-interview-transcriber's diar.js, using the ONNX graphs from
huggingface.co/NealCaren/Nemotron-3-Diarization-ONNX (embed.onnx, step.onnx or
step_int8.onnx, mel_filters.bin, silence_embeds.bin). Weights: OpenMDW-1.1.

usage: nemotron_onnx.py MODEL_DIR in.wav out.json [cuda|cpu] [step.onnx|step_int8.onnx]
"""
from __future__ import annotations

import json, sys, time
import numpy as np
import onnxruntime as ort

SR, NFFT, WIN, HOP, NMELS, PRE = 16000, 512, 400, 160, 128, 0.97
SUB, HID, NSPK = 8, 512, 8
CHUNK, RCTX, FIFO, UPD = 340, 40, 40, 300
CACHE, SIL_FR, PTH, LATEST, MINPOS, STRONG, WEAK = 264, 1, 0.25, 0.05, 0.5, 0.75, 1.5
LOG_HALF = np.log(0.5)


def log_mel(audio: np.ndarray, filters: np.ndarray, block: int = 20000) -> np.ndarray:
    """(N, 128) log-mel, N = floor(len/160). Pre-emphasis, centred STFT with zero
    padding, symmetric Hann(400) centred in 512, power, Slaney mel, log(x + 2^-24)."""
    a = audio.astype(np.float32)
    x = np.empty_like(a)
    x[0] = a[0]
    x[1:] = a[1:] - PRE * a[:-1]
    x = np.pad(x, (NFFT // 2, NFFT // 2))
    n = len(audio) // HOP
    win = np.zeros(NFFT)
    off = (NFFT - WIN) // 2
    win[off:off + WIN] = 0.5 - 0.5 * np.cos(2 * np.pi * np.arange(WIN) / (WIN - 1))
    out = np.empty((n, NMELS), np.float32)
    for f0 in range(0, n, block):
        f1 = min(n, f0 + block)
        idx = (np.arange(f0, f1) * HOP)[:, None] + np.arange(NFFT)[None, :]
        fr = x[idx].astype(np.float64) * win
        pw = np.abs(np.fft.rfft(fr, axis=1)) ** 2
        out[f0:f1] = np.log(pw @ filters.T.astype(np.float64) + 2.0 ** -24)
    return out


class SpeakerCache:
    def __init__(self, silence: np.ndarray):
        self.silence = silence
        self.emb = np.zeros((0, HID), np.float32)
        self.prob = np.zeros((0, NSPK), np.float32)
        self.fifo = np.zeros((0, HID), np.float32)
        self.compressed = False
        budget = CACHE // NSPK - SIL_FR
        self.min_pos, self.n_strong, self.n_weak = int(budget * MINPOS), int(budget * STRONG), int(budget * WEAK)

    def embeds(self):
        return np.concatenate([self.emb, self.fifo])

    def update(self, inp: np.ndarray, probs: np.ndarray, n_chunk: int):
        nc, nf = len(self.emb), len(self.fifo)
        fifo = np.concatenate([self.fifo, inp[nc + nf: nc + nf + n_chunk]])
        lf = len(fifo)
        popped = min(max(UPD, lf - FIFO), lf) if lf > FIFO else 0
        if popped:
            fifo_p = probs[nc: nc + lf]
            stored = self.prob if self.compressed else probs[:nc]
            ce = np.concatenate([self.emb, fifo[:popped]])
            cp = np.concatenate([stored, fifo_p[:popped]])
            fifo = fifo[popped:]
            if len(ce) > CACHE:
                ce, cp = self.compress(ce, cp)
                self.compressed = True
            self.emb, self.prob = ce, cp
        self.fifo = fifo

    def _scores(self, p):
        lc = np.log(np.maximum(1 - p, PTH))
        v = np.log(np.maximum(p, PTH)) - lc + lc.sum(1, keepdims=True) - LOG_HALF
        v = np.where(p > 0.5, v, -np.inf)
        pos = (v > 0).sum(0)
        v = np.where(~(v > 0) & (p > 0.5) & (pos >= self.min_pos)[None, :], -np.inf, v)
        return v

    @staticmethod
    def _boost(s, k, amount):
        n = len(s)
        for j in range(NSPK):
            order = np.lexsort((np.arange(n), -s[:, j]))  # score desc, index asc
            s[order[:min(k, n)], j] += amount

    def compress(self, emb, prob):
        n = len(prob)
        s = self._scores(prob.astype(np.float64))
        s[CACHE:] += LATEST
        self._boost(s, self.n_strong, -2 * LOG_HALF)
        self._boost(s, self.n_weak, -LOG_HALF)
        ns = n + SIL_FR
        full = np.full((ns, NSPK), np.inf)
        full[:n] = s
        flat_v = full.T.reshape(-1)  # index = spk * ns + t
        flat_i = np.arange(len(flat_v))
        order = np.lexsort((flat_i, -flat_v))[:CACHE]
        sentinel = ns * NSPK
        picked = np.sort(np.where(flat_v[order] == -np.inf, sentinel, flat_i[order]))
        f = np.where(picked == sentinel, n, np.minimum(picked % ns, n))
        emb_x = np.concatenate([emb, self.silence[None]])
        prob_x = np.concatenate([prob, np.zeros((1, NSPK), prob.dtype)])
        return emb_x[f], prob_x[f]


class Diarizer:
    def __init__(self, mdir: str, provider: str = "cuda", step: str = "step.onnx"):
        prov = (["CUDAExecutionProvider", "CPUExecutionProvider"] if provider == "cuda"
                else ["CPUExecutionProvider"])
        so = ort.SessionOptions()
        so.log_severity_level = 3
        self.embed = ort.InferenceSession(f"{mdir}/embed.onnx", so, providers=prov)
        self.step = ort.InferenceSession(f"{mdir}/{step}", so, providers=prov)
        self.filters = np.fromfile(f"{mdir}/mel_filters.bin", "<f4").reshape(NMELS, NFFT // 2 + 1)
        self.silence = np.fromfile(f"{mdir}/silence_embeds.bin", "<f4")

    def __call__(self, audio: np.ndarray) -> np.ndarray:
        """-> (N, 8) speaker probabilities, one row per 10 ms, speakers in arrival order."""
        feats = log_mel(audio, self.filters)
        n = len(feats)
        emb = []
        blk = SUB * 4096
        for f0 in range(0, n, blk):
            emb.append(self.embed.run(None, {"features": feats[None, f0:f0 + blk]})[0][0])
        emb = np.concatenate(emb)
        ne = len(emb)
        cache = SpeakerCache(self.silence)
        out = []
        for start in range(0, ne, CHUNK):
            end = min(start + CHUNK, ne)
            chunk = emb[start:min(end + RCTX, ne)]
            cached = cache.embeds()
            inp = np.concatenate([cached, chunk]).astype(np.float32)
            logits = self.step.run(None, {"embeds": inp[None]})[0][0]  # (8T, 8)
            p = 1 / (1 + np.exp(-logits.astype(np.float64)))
            pooled = p.reshape(len(inp), SUB, NSPK).mean(1)
            cache.update(inp, pooled, end - start)
            out.append(p[len(cached) * SUB:(len(cached) + end - start) * SUB])
        return np.concatenate(out)[:n].astype(np.float32)


def exclusive_turns(p: np.ndarray, thr=0.5, hop=0.01, min_on=0.3) -> list[dict]:
    lab = np.where(p.max(1) > thr, p.argmax(1), -1)
    edges = np.flatnonzero(np.diff(lab)) + 1
    bounds = np.concatenate([[0], edges, [len(lab)]])
    out = []
    for a, b in zip(bounds[:-1], bounds[1:]):
        if lab[a] >= 0 and (b - a) * hop >= min_on:
            out.append({"start": round(a * hop, 3), "end": round(b * hop, 3), "speaker": f"S{lab[a]}"})
    return out


def overlap_turns(p: np.ndarray, thr=0.5, hop=0.01, min_on=0.3) -> list[dict]:
    out = []
    for s in range(p.shape[1]):
        on = np.concatenate([[False], p[:, s] > thr, [False]])
        d = np.flatnonzero(np.diff(on.astype(np.int8)))
        for a, b in zip(d[::2], d[1::2]):
            if (b - a) * hop >= min_on:
                out.append({"start": round(a * hop, 3), "end": round(b * hop, 3), "speaker": f"S{s}"})
    return sorted(out, key=lambda t: t["start"])


if __name__ == "__main__":
    import wave
    from meter import Meter

    mdir, wav, outp = sys.argv[1:4]
    provider = sys.argv[4] if len(sys.argv) > 4 else "cuda"
    step = sys.argv[5] if len(sys.argv) > 5 else "step.onnx"
    with Meter() as m:
        t0 = time.perf_counter()
        d = Diarizer(mdir, provider, step)
        t1 = time.perf_counter()
        with wave.open(wav) as w:  # 16 kHz mono s16 WAV, as the worker's normalise step writes
            assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
            audio = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768.0
        p = d(audio)
        t2 = time.perf_counter()
    dur = len(audio) / SR
    meta = {"system": "nemotron-3-diarization (onnxruntime)", "device": provider, "step": step,
            "audio_s": round(dur, 1), "load_s": round(t1 - t0, 2), "wall_s": round(t2 - t1, 2),
            "rtfx": round(dur / (t2 - t1), 1), "vram_mib": m.peak_mib, "rss_mib": Meter.rss_mib(),
            "speakers_active": int((p > 0.5).any(0).sum())}
    print(json.dumps(meta))
    json.dump({"meta": meta, "turns": overlap_turns(p), "turns_exclusive": exclusive_turns(p)}, open(outp, "w"))
    np.savez_compressed(outp.replace(".json", ".npz"), p80=p[::8].astype(np.float16))
