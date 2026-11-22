"""Tests for align.py. Run: python -m pytest test_align.py  (or python test_align.py)"""
import numpy as np

from align import (assign_words, assign_words_probs, labelled_paragraphs, smooth,
                   snap_to_sentences, speaker_blocks, speaker_runs)


def W(*spec):
    """W(("Hello", 0.0), ("there.", 0.4), ...) -> words with end = next start."""
    out = [{"w": w, "start": s} for w, s in spec]
    for i, w in enumerate(out):
        w["end"] = out[i + 1]["start"] if i + 1 < len(out) else w["start"] + 0.4
    return out


def test_max_overlap_wins():
    words = W(("So", 1.0), ("yes.", 1.3))
    turns = [{"start": 0.0, "end": 1.1, "speaker": "A"}, {"start": 1.1, "end": 3.0, "speaker": "B"}]
    assert [w["spk"] for w in assign_words(words, turns)] == ["B", "B"]  # "So" 1.0-1.3: 0.1 A, 0.2 B


def test_word_in_diarizer_silence_gets_nearest_turn():
    words = W(("Yeah.", 5.0))
    turns = [{"start": 0.0, "end": 2.0, "speaker": "A"}, {"start": 5.6, "end": 9.0, "speaker": "B"}]
    assert assign_words(words, turns)[0]["spk"] == "B"


def test_overlapping_turns_pick_larger_overlap():
    words = W(("right", 2.0), ("okay", 2.5))
    turns = [{"start": 0.0, "end": 2.2, "speaker": "A"}, {"start": 1.9, "end": 4.0, "speaker": "B"}]
    assert [w["spk"] for w in assign_words(words, turns)] == ["B", "B"]


def test_long_pause_does_not_drag_word_to_next_speaker():
    # "done." starts at 3.0 and its nominal end is the next word at 4.0 (1 s pause);
    # B starts at 3.5. Capped at 0.6 s, "done." overlaps A 0.5 s vs B 0.1 s.
    words = W(("done.", 3.0), ("Next", 4.0))
    turns = [{"start": 0.0, "end": 3.5, "speaker": "A"}, {"start": 3.5, "end": 6.0, "speaker": "B"}]
    assert [w["spk"] for w in assign_words(words, turns)] == ["A", "B"]


def test_probs_assignment_and_silence_fallback():
    p = np.zeros((100, 2), np.float32)  # 80 ms frames, 8 s
    p[0:40, 0] = 0.9   # A 0.0-3.2 s
    p[50:100, 1] = 0.9  # B 4.0-8.0 s
    words = W(("one", 0.5), ("two", 3.6), ("three", 5.0))
    got = [w["spk"] for w in assign_words_probs(words, p, labels=["A", "B"])]
    # "two" 3.6-4.2 s is half silence; B holds the rest of its span
    assert got == ["A", "B", "B"]


def test_mid_segment_turn_change_splits_segment():
    seg = {"idx": 7, "start": 10.0, "end": 13.0,
           "words": [{"w": w, "start": s, "end": s + 0.3, "spk": k} for w, s, k in
                     [("That's", 10.0, "A"), ("it.", 10.3, "A"), ("Okay.", 10.9, "B"), ("Now", 11.3, "B"),
                      ("mission", 11.6, "B"), ("control.", 12.0, "B")]]}
    runs = speaker_runs(seg["words"])
    assert [(r["spk"], r["i0"], r["i1"]) for r in runs] == [("A", 0, 2), ("B", 2, 6)]
    blocks = speaker_blocks([seg])
    assert [b["spk"] for b in blocks] == ["A", "B"]
    assert blocks[1]["segments"][0]["i0"] == 2 and blocks[1]["segments"][0]["start"] == 10.9
    paras = labelled_paragraphs([seg], names={"A": "Rick", "B": "Gary"})
    assert [(p["spk"], p["at"], p["text"]) for p in paras] == [
        ("Rick", [7, 0], "That's it."), ("Gary", [7, 2], "Okay. Now mission control.")]


def test_same_speaker_across_segments_stays_one_block():
    segs = [{"idx": i, "start": s, "end": s + 1, "words": [{"w": "word.", "start": s, "end": s + 1, "spk": "A"}]}
            for i, s in enumerate([0.0, 2.0])]
    assert len(speaker_blocks(segs)) == 1


def test_snap_moves_change_to_sentence_end():
    words = [{"w": w, "start": i * 0.3, "end": i * 0.3 + 0.3, "spk": k} for i, (w, k) in
             enumerate([("We", "A"), ("go.", "A"), ("Got", "A"), ("it.", "B"), ("Now", "B")])]
    # diarizer switched one word late: "Got" belongs to B
    assert [w["spk"] for w in snap_to_sentences(words)] == ["A", "A", "B", "B", "B"]


def test_smooth_removes_flicker_keeps_long_island():
    mk = lambda spec: [{"w": "x", "start": s, "end": e, "spk": k} for s, e, k in spec]
    flick = mk([(0, 0.3, "A"), (0.3, 0.5, "B"), (0.5, 0.8, "A")])
    assert [w["spk"] for w in smooth(flick)] == ["A", "A", "A"]
    island = mk([(0, 0.3, "A"), (0.3, 1.2, "B"), (1.2, 1.5, "A")])  # a 0.9 s "Yeah." stays
    assert [w["spk"] for w in smooth(island)] == ["A", "B", "A"]


if __name__ == "__main__":
    import sys
    fails = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            try:
                fn()
                print("ok  ", name)
            except AssertionError as e:
                fails += 1
                print("FAIL", name, e)
    sys.exit(fails)
