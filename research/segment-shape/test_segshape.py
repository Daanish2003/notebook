import json
from pathlib import Path
from segshape import words, strip_fillers, paragraphs, sentences

SEG = {"start": 16.93, "end": 20.0, "text": "My name's Jason. I'm uh here,",
       "tokens": [" My", " n", "ame", "'", "s", " J", "as", "on", ".", " I", "'", "m", " uh", " here", ","],
       "timestamps": [0.0, 0.24, 0.32, 0.4, 0.4, 0.56, 0.64, 0.72, 0.8, 1.2, 1.28, 1.28, 1.6, 2.0, 2.4],
       "logprobs": [0.0] * 15}


def test_words_rebuild_text_and_times():
    w = words(SEG)
    assert [x["w"] for x in w] == ["My", "name's", "Jason.", "I'm", "uh", "here,"]
    assert " ".join(x["w"] for x in w) == SEG["text"]
    assert w[0]["start"] == 16.93 and w[0]["end"] == 17.17
    assert w[2]["start"] == 17.49 and w[2]["end"] == 18.13
    assert w[-1]["end"] == 20.0
    assert all(x["p"] == 1.0 for x in w)


def test_sample_words_rebuild_segment_text():
    # the sample files were written with words(); joined words must equal the Segment text
    for f in Path(__file__).parent.glob("*.json"):
        for s in json.load(open(f))["segments"]:
            assert " ".join(x["w"] for x in s["words"]) == s["text"]
            assert all(a["start"] <= a["end"] <= b["start"] + 1e-6 for a, b in zip(s["words"], s["words"][1:]))


def test_strip_fillers():
    assert strip_fillers("Uh Eric Domain and Justin Solomon.") == "Eric Domain and Justin Solomon."
    assert strip_fillers("teaching this class in uh introduction to algorithms") == \
        "teaching this class in introduction to algorithms"
    assert strip_fillers("here, uh, faculty") == "here, faculty"
    assert strip_fillers("Uh") == ""
    assert strip_fillers("So um. We go") == "So. We go"
    assert strip_fillers("It works. Um, so yes") == "It works. So yes"


def seg(start, end, text):
    ws = text.split()
    step = (end - start) / len(ws)
    return {"start": start, "end": end, "text": text,
            "words": [{"w": w, "start": start + j * step, "end": start + (j + 1) * step} for j, w in enumerate(ws)]}


W30 = " ".join(["word"] * 29) + " end."


def test_sentences_span_segments_and_record_gaps():
    s = sentences([seg(0, 2, "One two."), seg(3, 4, "Three"), seg(4.5, 6, "four. Five.")])
    assert [x["words"] for x in s] == [["One", "two."], ["Three", "four."], ["Five."]]
    assert [x["gap_before"] for x in s] == [0.0, 1.0, 0.0]
    assert s[2]["at"] == [2, 1]


def test_break_on_pause_after_enough_words():
    p = paragraphs([seg(0, 10, W30), seg(12, 14, "Next topic."), seg(14.2, 15, "More.")])
    assert [x["text"] for x in p] == [W30, "Next topic. More."]
    assert p[1]["at"] == [1, 0] and p[1]["start"] == 12


def test_no_break_for_short_paragraph_or_mid_sentence():
    assert len(paragraphs([seg(0, 2, "Short one."), seg(4, 5, "still same.")])) == 1
    assert len(paragraphs([seg(0, 10, " ".join(["w"] * 40)), seg(12, 13, "rest.")])) == 1


def test_long_pause_breaks_even_mid_sentence():
    assert len(paragraphs([seg(0, 1, "a"), seg(6, 7, "b.")])) == 2


def test_max_words_splits_inside_a_long_segment():
    text = " ".join([" ".join(["w"] * 19) + " end."] * 12)  # 240 words, one segment, no pauses
    p = paragraphs([seg(0, 80, text)])
    assert [len(x["text"].split()) for x in p] == [120, 120]
    assert p[1]["at"] == [0, 120]


def test_hard_max_without_punctuation():
    p = paragraphs([seg(i * 5, i * 5 + 4.9, " ".join(["w"] * 50)) for i in range(6)])
    assert max(len(x["text"].split()) for x in p) <= 250
