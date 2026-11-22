"""Score diarization turns against word-level reference labels.

usage: score.py ref.json hyp.json [t0 t1] [--smooth]

hyp.json: {"turns": [{"start", "end", "speaker"}], "meta": {...}}

Metrics (only on ASR words that aligned to the published transcript):
- word accuracy: share of words whose hypothesis speaker, after the best
  one-to-one mapping of hypothesis to reference speakers, is the reference one
  (a word-level analogue of 1 - DER that ignores missed/false speech).
- speakers: hypothesis speakers holding >= 1% of words vs reference speakers.
- change points: for every reference speaker change between consecutive words,
  the distance to the nearest hypothesis change (in the word-assigned output);
  median, share within 0.5 s / 1 s, and share "found" (within 1 s).
- short turns: reference turns of <= 3 words ("Yeah.", "Right.", "Cool.") and
  how many of their words got the right speaker.
"""
import itertools, json, statistics, sys

SNAP = '--snap' in sys.argv

from align import assign_words, assign_words_probs, smooth as smooth_fn, snap_to_sentences


def best_map(pairs, hyp_spk, ref_spk):
    """Maximise matched words with a one-to-one hyp->ref map (brute force over the
    smaller side, fine for <= 8 speakers)."""
    count = {}
    for h, r in pairs:
        count[(h, r)] = count.get((h, r), 0) + 1
    hyp_spk, ref_spk = list(hyp_spk), list(ref_spk)
    best, best_m = -1, {}
    if len(hyp_spk) <= len(ref_spk):
        for perm in itertools.permutations(ref_spk, len(hyp_spk)):
            s = sum(count.get((h, r), 0) for h, r in zip(hyp_spk, perm))
            if s > best:
                best, best_m = s, dict(zip(hyp_spk, perm))
    else:
        # more hypothesis speakers than reference: map the top ones, extras stay unmapped
        for perm in itertools.permutations(hyp_spk, len(ref_spk)):
            s = sum(count.get((h, r), 0) for h, r in zip(perm, ref_spk))
            if s > best:
                best, best_m = s, dict(zip(perm, ref_spk))
    return best_m


def score(ref_words, turns, t0=None, t1=None, do_smooth=False, probs=None, offset=0.0):
    W = [w for w in ref_words if (t0 is None or w["start"] >= t0) and (t1 is None or w["start"] < t1)]
    H = assign_words(W, turns) if probs is None else assign_words_probs(W, probs, offset=offset)
    if do_smooth:
        H = smooth_fn(H)
    if SNAP:
        H = snap_to_sentences(H)
    pairs = [(h["spk"], w["spk"]) for h, w in zip(H, W) if w["spk"]]
    ref_spk = sorted({r for _, r in pairs if sum(1 for _, x in pairs if x == r) >= 0.01 * len(pairs)})
    from collections import Counter
    hc = Counter(h for h, _ in pairs)
    hyp_spk = [h for h, c in hc.most_common() if c >= 0.01 * len(pairs)]
    # cap permutation search
    hyp_for_map = hyp_spk[:8]
    m = best_map(pairs, hyp_for_map, ref_spk)
    acc = sum(1 for h, r in pairs if m.get(h) == r) / max(len(pairs), 1)

    # change points (reference: consecutive matched words with different speakers)
    hyp_changes = [H[i]["start"] for i in range(1, len(H)) if H[i]["spk"] != H[i - 1]["spk"]]
    ref_changes = []
    last = None
    for w in W:
        if not w["spk"]:
            continue
        if last and last["spk"] != w["spk"]:
            ref_changes.append(w["start"])
        last = w
    import bisect
    dists = []
    for c in ref_changes:
        k = bisect.bisect_left(hyp_changes, c)
        d = min([abs(hyp_changes[j] - c) for j in (k - 1, k) if 0 <= j < len(hyp_changes)] or [99])
        dists.append(d)
    # spurious hypothesis changes: farther than 1 s from any reference change
    spurious = 0
    for c in hyp_changes:
        k = bisect.bisect_left(ref_changes, c)
        d = min([abs(ref_changes[j] - c) for j in (k - 1, k) if 0 <= j < len(ref_changes)] or [99])
        spurious += d > 1.0

    # short reference turns
    turns_ref = []
    for i, w in enumerate(W):
        if not w["spk"]:
            continue
        if turns_ref and turns_ref[-1]["spk"] == w["spk"]:
            turns_ref[-1]["idx"].append(i)
        else:
            turns_ref.append({"spk": w["spk"], "idx": [i]})
    short = [t for t in turns_ref if len(t["idx"]) <= 3]
    short_ok = sum(1 for t in short if all(m.get(H[i]["spk"]) == t["spk"] for i in t["idx"]))
    return {
        "words_scored": len(pairs),
        "word_acc": round(acc, 4),
        "ref_speakers": len(ref_spk),
        "hyp_speakers": len(hyp_spk),
        "hyp_speakers_any": len(hc),
        "ref_changes": len(ref_changes),
        "hyp_changes": len(hyp_changes),
        "change_median_s": round(statistics.median(dists), 2) if dists else None,
        "change_within_0.5s": round(sum(d <= 0.5 for d in dists) / max(len(dists), 1), 3),
        "change_within_1s": round(sum(d <= 1.0 for d in dists) / max(len(dists), 1), 3),
        "spurious_changes": spurious,
        "short_turns": len(short),
        "short_turns_ok": short_ok,
        "mapping": m,
    }


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    ref = json.load(open(args[0]))["words"]
    hyp = json.load(open(args[1]))
    t0 = float(args[2]) if len(args) > 2 else None
    t1 = float(args[3]) if len(args) > 3 else None
    key = "turns_exclusive" if "--exclusive" in sys.argv else "turns"
    off = next((float(a.split("=")[1]) for a in sys.argv if a.startswith("--offset=")), 0.0)
    turns = [{**t, "start": t["start"] + off, "end": t["end"] + off} for t in hyp[key]]
    probs = None
    if "--probs" in sys.argv:
        import numpy as np
        probs = np.load(args[1].replace(".json", ".npz"))["p80"].astype("float32")
        key = "probs"
    r = score(ref, turns, t0, t1, "--smooth" in sys.argv, probs, off)
    r["variant"] = key + ("+smooth" if "--smooth" in sys.argv else "") + ("+snap" if SNAP else "")
    print(json.dumps({"file": args[1], **hyp.get("meta", {}), **r}))
