"""Turn onnx-asr TimestampedSegmentResult data into words and readable paragraphs.

Input segment dict: start, end (absolute seconds), text, tokens (str, word-initial
tokens start with " " because onnx-asr maps SentencePiece "▁" to a space),
timestamps (token START times in seconds, relative to the segment start, on an
80 ms grid), logprobs (per token).
"""

from __future__ import annotations

import math
import re

FILLERS = {"uh", "um", "er", "ah", "hmm", "mm", "erm"}
SENTENCE_END = re.compile(r"[.?!]$")


def words(seg: dict) -> list[dict]:
    """Rebuild words with absolute start/end times from subword tokens.

    - A token starting with " " begins a new word; any other token (subword
      pieces, "'", ".", ",", "?") is glued onto the current word.
    - start = segment start + timestamp of the word's first token.
    - end = start of the next word in the same segment; the last word ends at
      the segment end. (The TDT model predicts durations, but onnx-asr drops
      them, and VAD splits on any pause over ~160 ms, so in-segment gaps are short.)
    - p = mean token probability (exp of mean logprob), a rough confidence.
    """
    out: list[dict] = []
    for tok, ts, lp in zip(seg["tokens"], seg["timestamps"],
                           seg.get("logprobs") or [0.0] * len(seg["tokens"])):
        if tok.startswith(" ") or not out:
            out.append({"w": tok.lstrip(" "), "start": seg["start"] + ts, "_lp": [lp]})
        else:
            out[-1]["w"] += tok
            out[-1]["_lp"].append(lp)
    for i, w in enumerate(out):
        w["end"] = out[i + 1]["start"] if i + 1 < len(out) else seg["end"]
        w["p"] = round(math.exp(sum(w["_lp"]) / len(w["_lp"])), 3)
        w["start"], w["end"] = round(w["start"], 2), round(w["end"], 2)
        del w["_lp"]
    return out


def is_filler(word: str) -> bool:
    return re.sub(r"[^\w]", "", word).lower() in FILLERS


def strip_fillers(text: str) -> str:
    """Remove uh/um for reading, fixing up commas and capitalisation."""
    toks = text.split(" ")
    out: list[str] = []
    cap_next = False
    for t in toks:
        if is_filler(t):
            trail = re.sub(r"[\w]", "", t)  # punctuation the filler carried, e.g. "uh," or "Um."
            if out and trail and trail[-1] in ".?!" and not SENTENCE_END.search(out[-1]):
                out[-1] = out[-1].rstrip(",") + trail[-1]
            if not out or SENTENCE_END.search(out[-1]) or t[:1].isupper():
                cap_next = True
            continue
        if cap_next and t:
            t = t[0].upper() + t[1:]
            cap_next = False
        out.append(t)
    s = " ".join(out)
    s = re.sub(r",(\s*,)+", ",", s)
    s = re.sub(r",([.?!])", r"\1", s)
    return s.strip()


def sentences(segs: list[dict], *, long_pause_s: float = 4.0, max_words: int = 200) -> list[dict]:
    """Split the word stream of consecutive Segments into sentences.

    A sentence ends at a word ending in . ? or !. A sentence may span Segments
    (VAD splits mid-sentence at pauses). Each sentence records the silence before
    it: the gap to the previous Segment if it starts a Segment, else 0 (in-segment
    pauses are < min_silence_duration_ms by construction). A Segment boundary with
    a silence >= long_pause_s, or an unfinished sentence already >= max_words
    (run-on speech with no punctuation), also closes it.
    Segments need "words" (from words()) or get them computed.
    """
    out: list[dict] = []
    cur: dict | None = None
    prev_end = None
    for si, seg in enumerate(segs):
        ws = seg["words"] if "words" in seg else words(seg)
        for wi, w in enumerate(ws):
            gap = (seg["start"] - prev_end) if (wi == 0 and prev_end is not None) else 0.0
            if cur is not None and wi == 0 and (gap >= long_pause_s or len(cur["words"]) >= max_words):
                out.append(cur)
                cur = None
            if cur is None:
                cur = {"start": w["start"], "gap_before": round(gap, 2), "at": [si, wi], "words": []}
            cur["words"].append(w["w"])
            cur["end"] = w["end"]
            if SENTENCE_END.search(w["w"]):
                out.append(cur)
                cur = None
        if ws:
            prev_end = seg["end"]
    if cur is not None:
        out.append(cur)
    return out


def paragraphs(segs: list[dict], *, pause_s: float = 1.5, min_words: int = 30,
               max_words: int = 120, hard_max_words: int = 200,
               long_pause_s: float = 4.0) -> list[dict]:
    """Group sentences (see sentences()) into paragraphs.

    Start a new paragraph before a sentence when
      1. the silence before it is >= long_pause_s, or
      2. the silence before it is >= pause_s and the paragraph has >= min_words, or
      3. adding it would pass max_words and the paragraph has >= min_words, or
      4. the paragraph already has >= hard_max_words.
    A paragraph is {start, end, at: [segment index, word index] of its first word, text}.
    """
    paras: list[dict] = []
    cur: list[dict] = []
    n = 0
    for s in sentences(segs, long_pause_s=long_pause_s, max_words=hard_max_words):
        k = len(s["words"])
        if cur and (s["gap_before"] >= long_pause_s
                    or (s["gap_before"] >= pause_s and n >= min_words)
                    or (n + k > max_words and n >= min_words)
                    or n >= hard_max_words):
            paras.append(_para(cur))
            cur, n = [], 0
        cur.append(s)
        n += k
    if cur:
        paras.append(_para(cur))
    return paras


def _para(sents: list[dict]) -> dict:
    return {"start": sents[0]["start"], "end": sents[-1]["end"], "at": sents[0]["at"],
            "text": " ".join(w for s in sents for w in s["words"])}


def ts(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 3600}:{sec // 60 % 60:02d}:{sec % 60:02d}" if sec >= 3600 else f"{sec // 60}:{sec % 60:02d}"
