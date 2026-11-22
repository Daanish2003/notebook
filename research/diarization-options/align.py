"""Align diarization turns with Notebook Segments and word timings.

This is the piece Notebook's worker would run after transcription: it takes the
diarizer's turns ({start, end, speaker}) and the Segments' words (as rebuilt by
segshape.words: {w, start, end, p}) and

1. assigns one speaker to every word (`assign_words`),
2. optionally removes one-word flickers that are diarizer noise (`smooth`),
3. splits each Segment into speaker runs, so a turn change mid-Segment becomes
   a run boundary (`speaker_runs`), and
4. renders speaker-labelled paragraphs (`labelled_paragraphs`).

Nothing about Segments changes: the speaker is stored per word (or derived runs),
so the VAD Segment boundaries stay as they are.
"""
from __future__ import annotations

import bisect
import re

# Parakeet gives token starts only; a word's "end" is the next word's start, which
# can include up to ~1 s of pause inside a Segment. Cap the interval we score so a
# pause does not pull the word towards whoever speaks after it.
MAX_WORD_S = 0.6
MIN_WORD_S = 0.08
SENT_END = re.compile(r"[.?!][\"')\]]?$")


def assign_words(words: list[dict], turns: list[dict]) -> list[dict]:
    """Return a copy of `words` with "spk" set from the turn that overlaps it most.

    `turns` may overlap each other (overlapped speech). A word touching no turn
    (diarizer said "silence" but ASR heard a word) gets the nearest turn's speaker.
    """
    turns = sorted(turns, key=lambda t: t["start"])
    starts = [t["start"] for t in turns]
    out = []
    for w in words:
        s = w["start"]
        e = max(min(w["end"], s + MAX_WORD_S), s + MIN_WORD_S)
        best, best_ov = None, 0.0
        # only turns starting before e can overlap; scan back over a bounded window
        i = bisect.bisect_left(starts, e)
        j = i - 1
        while j >= 0 and starts[j] > s - 600:  # turns are rarely > 10 min
            t = turns[j]
            ov = min(e, t["end"]) - max(s, t["start"])
            if ov > best_ov:
                best, best_ov = t["speaker"], ov
            j -= 1
        if best is None and turns:
            mid = (s + e) / 2
            cand = [turns[k] for k in (i - 1, i) if 0 <= k < len(turns)]
            # also consider the longest-ending earlier turn
            near = min(cand, key=lambda t: max(t["start"] - mid, mid - t["end"], 0.0))
            best = near["speaker"]
        out.append({**w, "spk": best})
    return out


def assign_words_probs(words: list[dict], probs, hop: float = 0.08, offset: float = 0.0,
                       labels: list[str] | None = None) -> list[dict]:
    """Like assign_words, but from frame-level speaker probabilities (an (N, S)
    array, one row per `hop` seconds, as Sortformer/Nemotron emit): the word goes
    to the speaker with the most probability mass over its span. A word over
    near-silence is widened by up to 1 s each side, then falls back to the
    previous word's speaker."""
    n, S = len(probs), len(probs[0])
    labels = labels or [f"S{k}" for k in range(S)]

    def mass(a, b):
        f0 = max(0, int((a - offset) / hop))
        f1 = min(n, max(f0 + 1, int(round((b - offset) / hop + 0.5))))
        acc = [0.0] * S
        for f in range(f0, f1):
            row = probs[f]
            for k in range(S):
                acc[k] += float(row[k])
        k = max(range(S), key=acc.__getitem__)
        return k, acc[k] / max(f1 - f0, 1)

    out, prev = [], None
    for w in words:
        s = w["start"]
        e = max(min(w["end"], s + MAX_WORD_S), s + MIN_WORD_S)
        k, m = mass(s, e)
        pad = 0.25
        while m < 0.2 and pad <= 1.0:
            k, m = mass(s - pad, e + pad)
            pad *= 2
        spk = labels[k] if (m >= 0.05 or prev is None) else prev
        prev = spk
        out.append({**w, "spk": spk})
    return out


def smooth(words: list[dict], max_words: int = 1, max_s: float = 0.5) -> list[dict]:
    """Relabel short islands (<= max_words and <= max_s long) whose neighbours on
    both sides agree with each other. Keeps genuine backchannels that sit at a
    pause ("Yeah." after a long answer) because their neighbours differ or the
    island is longer than max_s. Returns a new list."""
    out = [dict(w) for w in words]
    n = len(out)
    i = 0
    while i < n:
        j = i
        while j + 1 < n and out[j + 1]["spk"] == out[i]["spk"]:
            j += 1
        if 0 < i and j < n - 1:
            left, right = out[i - 1]["spk"], out[j + 1]["spk"]
            dur = out[j]["end"] - out[i]["start"]
            if left == right and (j - i + 1) <= max_words and dur <= max_s:
                for k in range(i, j + 1):
                    out[k]["spk"] = left
        i = j + 1
    return out


def snap_to_sentences(words: list[dict], max_shift: int = 3) -> list[dict]:
    """Move a speaker change that falls within `max_shift` words of a sentence end
    onto that sentence end (people rarely hand over mid-sentence; the diarizer's
    boundary is often a word or two late or early). Returns a new list."""
    out = [dict(w) for w in words]
    ends = lambda i: bool(SENT_END.search(out[i]["w"]))
    for i in range(1, len(out)):
        if out[i]["spk"] == out[i - 1]["spk"] or ends(i - 1):
            continue
        a, b = out[i - 1]["spk"], out[i]["spk"]
        target = None
        for d in range(1, max_shift + 1):
            if i - 1 - d >= 0 and ends(i - 1 - d) and all(w["spk"] == a for w in out[i - d:i]):
                target = i - d
            elif i - 1 + d < len(out) and ends(i - 1 + d) and all(w["spk"] == b for w in out[i:i + d]):
                target = i + d
            if target is not None:
                break
        if target is None:
            continue
        rng = range(target, i) if target < i else range(i, target)
        for k in rng:
            out[k]["spk"] = b if target < i else a
    return out


def speaker_runs(seg_words: list[dict]) -> list[dict]:
    """Split one Segment's words into maximal runs of one speaker.

    -> [{"spk", "start", "end", "i0", "i1"}] with word indices [i0, i1)."""
    runs: list[dict] = []
    for i, w in enumerate(seg_words):
        if runs and runs[-1]["spk"] == w["spk"]:
            runs[-1]["end"], runs[-1]["i1"] = w["end"], i + 1
        else:
            runs.append({"spk": w["spk"], "start": w["start"], "end": w["end"], "i0": i, "i1": i + 1})
    return runs


def speaker_blocks(segments: list[dict]) -> list[dict]:
    """Cut the Transcript at every speaker change, including inside a Segment.

    `segments` carry "words" that already have "spk". Returns blocks
    [{"spk", "segments": [slice, ...]}] where each slice is a piece of one Segment
    ({"idx", "start", "end", "words", "i0"}; i0 = index of its first word in the
    Segment), so a Segment with a turn change appears as two slices in two blocks."""
    blocks: list[dict] = []
    for seg in segments:
        for r in speaker_runs(seg["words"]):
            piece = {"idx": seg.get("idx"), "start": r["start"], "end": r["end"], "i0": r["i0"],
                     "words": seg["words"][r["i0"]:r["i1"]]}
            if blocks and blocks[-1]["spk"] == r["spk"]:
                blocks[-1]["segments"].append(piece)
            else:
                blocks.append({"spk": r["spk"], "segments": [piece]})
    return blocks


def labelled_paragraphs(segments: list[dict], names: dict | None = None, **rules) -> list[dict]:
    """Speaker-labelled paragraphs: a new paragraph on every speaker change, and
    inside one speaker's block the segment-shape paragraph rules apply unchanged
    (segshape.paragraphs over the block's Segment slices).

    -> [{"spk", "start", "end", "at": [segment idx, word idx], "text"}]"""
    from segshape import paragraphs

    names = names or {}
    out = []
    for b in speaker_blocks(segments):
        for p in paragraphs(b["segments"], **rules):
            piece = b["segments"][p["at"][0]]
            out.append({"spk": names.get(b["spk"], b["spk"]), "start": p["start"], "end": p["end"],
                        "at": [piece["idx"], piece["i0"] + p["at"][1]], "text": p["text"]})
    return out
