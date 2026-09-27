"""Tests for tools/transcribe.py. No model or network needed.

Run: python tools/test_transcribe.py
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from transcribe import Word, words_to_cues, to_srt, to_paragraphs, clean_text, srt_timestamp, balance_two_lines  # noqa: E402

# timestamps
assert srt_timestamp(0) == "00:00:00,000"
assert srt_timestamp(3725.4567) == "01:02:05,457"

# a long run of speech with a sentence end and a pause
text = ("So um the idea was simple. We build the bulb first, then we break it, "
        "and uh the pieces become the navigation for the whole site. "
        "That is the part I care about.")
toks = text.split()
words, t = [], 0.0
for i, tok in enumerate(toks):
    if i == 20: t += 1.5          # a real pause mid-sentence
    words.append(Word(t, t + 0.3, tok)); t += 0.35
cues = words_to_cues(words)
srt = to_srt(cues)
for c in cues:
    assert len(c.text) <= 84, c.text
    assert c.end - c.start <= 7.0 + 1e-9
for line in srt.splitlines():
    if line and not line[0].isdigit():
        assert len(line) <= 42, line
# cues are ordered and do not overlap
for a, b in zip(cues, cues[1:]):
    assert a.end <= b.start + 1e-9, (a, b)
# first cue closes at the sentence end
assert cues[0].text.endswith("simple."), cues[0].text
# every word survives into the captions
assert " ".join(c.text for c in cues).split() == toks
# srt numbering and arrow format
assert re.search(r"^1\n00:00:00,000 --> 00:00:0\d,\d{3}\n", srt)

# clean transcript
assert clean_text("So um the idea, uh, was simple.") == "So the idea, was simple."
assert clean_text("um, okay. uh so we start.") == "Okay. So we start."
assert clean_text("Umbrella and hummus stay.") == "Umbrella and hummus stay."
paras = to_paragraphs([(0, 2, " Hello there, um, friend."), (2.2, 4, " Next bit."), (8, 9, " uh new topic.")])
assert paras == "Hello there, friend. Next bit.\n\nNew topic.\n"
assert "um" in to_paragraphs([(0, 1, "So um yes.")], keep_fillers=True)

# balancing puts two similar-length lines
b = balance_two_lines("the pieces become the navigation for the whole site today")
assert "\n" in b and all(len(l) <= 42 for l in b.split("\n")), b
# tiny cue gets stretched to minimum without overlapping next
c = words_to_cues([Word(0, 0.2, "Yes."), Word(0.3, 0.5, "No.")])
assert len(c) == 1 and c[0].text == "Yes. No." and c[0].end - c[0].start >= 0.8   # too short to stand alone
c = words_to_cues([Word(0, 0.2, "Yes."), Word(0.9, 1.1, "No.")])
assert len(c) == 2 and c[0].end <= c[1].start, c    # pause splits; stretch stops at next cue
from transcribe import is_filler
assert is_filler("um") and is_filler("Uh,") and is_filler("hmm.") and not is_filler("umbrella") and not is_filler("a")
print("ALL TESTS PASSED")
from transcribe import drop_fillers
out = drop_fillers([Word(0,.3,"Um,"), Word(.4,.7,"this"), Word(.7,.9,"works."), Word(1,1.2,"uh"), Word(1.3,1.5,"next"), Word(1.6,1.8,"and"), Word(1.9,2,"um"), Word(2.1,2.3,"more.")])
assert [w.text for w in out] == ["This", "works.", "Next", "and", "more."], [w.text for w in out]
print("FILLER TESTS PASSED")
