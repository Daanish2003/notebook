"""Build word-level reference speaker labels by aligning a published, speaker-labelled
transcript (NASA's "Houston We Have a Podcast" pages) to our ASR words.

usage: reflabels.py transcript.txt asr.raw.json out.json

The NASA transcript is edited (fillers removed, some backchannels dropped), so only
ASR words that align to a transcript word get a label ("matched"); the rest are
left as None and excluded from scoring.
"""
import difflib, json, re, sys

from segshape import words  # same word rebuild as research/segment-shape

ALIAS = {"Host": "Gary Jordan", "Gary Jordan (Host)": "Gary Jordan"}
LINE = re.compile(r"^([A-Z][A-Za-z .'()-]{1,40}?):\s*(.*)$")


def norm(w: str) -> str:
    return re.sub(r"[^a-z0-9]", "", w.lower())


def transcript_words(path: str) -> list[tuple[str, str]]:
    out = []
    started = False
    for line in open(path, encoding="utf-8"):
        m = LINE.match(line.strip())
        if not m:
            continue
        spk, text = m.group(1), m.group(2)
        if spk.startswith("Gary Jordan") or spk in ALIAS:
            started = True
        if not started:
            continue
        spk = ALIAS.get(spk, spk)
        if spk.lower() in {"transcript", "credits", "note"}:
            continue
        text = re.sub(r"\[[^\]]*\]", " ", text)  # [Music], editorial insertions
        for w in text.split():
            n = norm(w)
            if n:
                out.append((n, spk))
    return out


def main() -> None:
    tpath, apath, opath = sys.argv[1:4]
    tw = transcript_words(tpath)
    raw = json.load(open(apath))
    aw = []
    for si, s in enumerate(raw["segments"]):
        for w in words(s):
            aw.append({"seg": si, "w": w["w"], "start": w["start"], "end": w["end"]})
    a_norm = [norm(w["w"]) for w in aw]
    sm = difflib.SequenceMatcher(None, a_norm, [t[0] for t in tw], autojunk=False)
    for w in aw:
        w["spk"] = None
    matched = 0
    for blk in sm.get_matching_blocks():
        if blk.size < 2:  # single-word matches are often spurious
            continue
        for k in range(blk.size):
            aw[blk.a + k]["spk"] = tw[blk.b + k][1]
            matched += 1
    # trim the very end of the transcript (credits) is handled by the matcher; report coverage
    spk = sorted({w["spk"] for w in aw if w["spk"]})
    print(f"asr words {len(aw)}, transcript words {len(tw)}, matched {matched} "
          f"({matched / len(aw):.0%}), speakers {spk}")
    json.dump({"speakers": spk, "words": aw}, open(opath, "w"))


if __name__ == "__main__":
    main()
