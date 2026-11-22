"""Build a compact `[mm:ss] paragraph text` transcript from a segment-shape JSON.

Usage: python3 -I build_input.py mit-6006-lecture1.json > transcript.txt

Paragraph boundaries come from the JSON's `paragraphs[].at` = [segment idx, word idx].
"""

import json
import sys


def words(doc):
    for si, seg in enumerate(doc["segments"]):
        for wi, w in enumerate(seg["words"]):
            yield (si, wi), w["w"]


def main(path):
    doc = json.load(open(path))
    starts = [tuple(p["at"]) for p in doc["paragraphs"]]
    paras = {i: [] for i in range(len(starts))}
    cur = -1
    for pos, w in words(doc):
        while cur + 1 < len(starts) and pos >= starts[cur + 1]:
            cur += 1
        paras[max(cur, 0)].append(w)
    for i, p in enumerate(doc["paragraphs"]):
        t = int(p["start"])
        print(f"[{t // 60:02d}:{t % 60:02d}] {' '.join(paras[i])}")


if __name__ == "__main__":
    main(sys.argv[1])
