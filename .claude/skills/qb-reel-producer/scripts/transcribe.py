#!/usr/bin/env python3
"""Step 2: local transcription with the cached models (no download, no API).

  transcribe.py <project dir> [--no-whisper]

Primary: NVIDIA Parakeet TDT 0.6B v2 via sherpa-onnx (word timings, 80 ms resolution).
Cross-check: Whisper small.en via sherpa-onnx, chunked on the silence map (it only takes 30 s).
Phrase on/offsets are refined from the audio energy envelope (10 ms) because token times are coarse.
Product names are corrected with references/tool-lexicon.json. Every word where the two models
disagree is written to transcript/disagreements.json for a human/Claude decision; nothing is
silently "fixed" beyond the lexicon.

Outputs in <project>/transcript/: words.json, phrases.json, source.txt, source.srt, source.vtt,
source.json, source.tsv, tools.json, tools.md, disagreements.json
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import need_venv, PARAKEET, WHISPER, SKILL, load, save, ts
need_venv()
import difflib, re
import numpy as np, soundfile as sf, sherpa_onnx as so

PHRASE_GAP = 0.35


def parakeet_words(audio, sr):
    rec = so.OfflineRecognizer.from_transducer(
        encoder=str(PARAKEET / "encoder.int8.onnx"), decoder=str(PARAKEET / "decoder.int8.onnx"),
        joiner=str(PARAKEET / "joiner.int8.onnx"), tokens=str(PARAKEET / "tokens.txt"),
        model_type="nemo_transducer", num_threads=4)
    s = rec.create_stream(); s.accept_waveform(sr, audio); rec.decode_stream(s)
    r = s.result
    durs = list(getattr(r, "durations", []) or [])
    words = []
    for i, (t, tok) in enumerate(zip(r.timestamps, r.tokens)):
        end = t + max(durs[i], 0.04) if i < len(durs) else (r.timestamps[i + 1] if i + 1 < len(r.tokens) else t + 0.3)
        if tok.startswith((" ", "▁")) or not words:
            words.append({"w": tok.replace("▁", " ").strip(), "s": round(t, 3), "e": round(end, 3)})
        else:
            words[-1]["w"] += tok; words[-1]["e"] = round(end, 3)
    for a, b in zip(words, words[1:]):
        a["e"] = min(a["e"], b["s"])
    return [w for w in words if w["w"]], r.text


def envelope(audio, sr):
    hop = int(0.01 * sr)
    n = len(audio) // hop
    rms = np.sqrt(np.mean(audio[: n * hop].reshape(n, hop) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(rms)


def lexicon():
    lx = load(SKILL / "references/tool-lexicon.json")["tools"]
    pats = []
    for key, t in lx.items():
        for form in [t["name"], *t["aliases"]]:
            toks = re.findall(r"[a-z0-9]+", form.lower())
            if toks: pats.append((toks, key, t["name"]))
    return sorted(pats, key=lambda p: -len(p[0])), lx


def norm(w):
    return re.sub(r"[^a-z0-9]", "", w.lower())


def apply_lexicon(words, pats):
    """Replace alias spans with canonical names; returns words and tool hits (index, key)."""
    out, hits, i = [], [], 0
    while i < len(words):
        for toks, key, name in pats:
            span = words[i:i + len(toks)]
            if len(span) == len(toks) and [norm(w["w"]) for w in span] == toks:
                tail = re.sub(r"^.*?([^A-Za-z0-9]*)$", r"\1", span[-1]["w"])
                head = re.sub(r"^([^A-Za-z0-9]*).*$", r"\1", span[0]["w"])
                out.append({"w": head + name + tail, "s": span[0]["s"], "e": span[-1]["e"], "tool": key,
                            "starts": [x for w in span for x in w.get("starts", [w["s"]])],
                            **({"was": " ".join(w["w"] for w in span)} if " ".join(w["w"] for w in span) != head + name + tail else {})})
                hits.append((len(out) - 1, key)); i += len(toks); break
        else:
            out.append(dict(words[i])); i += 1
    return out, hits


def speech_runs(db, thr, min_len=5, bridge=6):
    """Frames (10 ms) above thr -> runs; bridge dips < 60 ms, drop blips < 50 ms. Returns [(start_s, end_s)]."""
    on = db > thr
    runs, i, n = [], 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]: j += 1
            runs.append([i, j]); i = j
        else:
            i += 1
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] < bridge: merged[-1][1] = r[1]
        else: merged.append(r)
    return [(a / 100, b / 100) for a, b in merged if b - a >= min_len]


def phrases_from(words, db):
    floor = float(np.percentile(db, 10)); thr = floor + 10
    runs = speech_runs(db, thr)
    def silent_between(a, b, need=0.35):  # a real pause between two word starts?
        for (s0, e0), (s1, e1) in zip(runs, runs[1:]):
            if a < s1 <= b + 0.1 and s1 - e0 >= need and e0 >= a - 0.05: return True
        return False
    groups, cur = [], []
    for w in words:
        if cur and (silent_between(cur[-1]["s"], w["s"]) or w["s"] - cur[-1]["e"] >= PHRASE_GAP * 2):
            groups.append(cur); cur = []
        cur.append(w)
        if re.search(r"[,.?!]$", w["w"]):
            groups.append(cur); cur = []
    if cur: groups.append(cur)
    # assign every speech run to the phrase whose word starts are nearest (<= 0.35 s); drop stray blips
    starts = [(t, gi) for gi, g in enumerate(groups) for w in g for t in w.get("starts", [w["s"]])]
    owned = {gi: [] for gi in range(len(groups))}
    for r0, r1 in runs:
        inside = sorted({gi for t, gi in starts if r0 - 0.06 <= t <= r1})
        if inside:
            for gi in inside: owned[gi].append((r0, r1))
            continue
        d, gi = min((min(abs(t - r0), abs(t - r1)), gi) for t, gi in starts)
        if d <= 0.35: owned[gi].append((r0, r1))
    out = []
    for gi, g in enumerate(groups):
        rs = owned[gi]
        on = min(r[0] for r in rs) if rs else g[0]["s"]
        off = max(r[1] for r in rs) if rs else g[-1]["e"]
        out.append({"text": " ".join(w["w"] for w in g), "on": round(on, 2), "off": round(max(off, on + 0.1), 2),
                    "first_s": g[0]["s"], "last_s": g[-1]["s"],
                    "words": [w["w"] for w in g], "tools": sorted({w["tool"] for w in g if "tool" in w})})
    # phrases sharing one continuous run: split at the deepest dip after the first phrase has started
    for a, b in zip(out, out[1:]):
        if a["off"] > b["on"]:
            i0 = int(a["on"] * 100)
            strong = i0 + int(np.argmax(db[i0:int((b["first_s"] + 0.15) * 100)] > floor + 20))
            lo = int(max(strong / 100 + 0.12, a["last_s"]) * 100); hi = int((b["first_s"] + 0.15) * 100)
            k = lo + int(np.argmin(db[lo:hi])) if hi > lo else lo
            a["off"], b["on"] = round(k / 100, 2), round(k / 100 + 0.01, 2)
    for p in out:
        i0, i1 = int(p["on"] * 100), max(int(p["on"] * 100) + 1, int(p["off"] * 100))
        k = np.argmax(db[i0:i1] > floor + 20)
        p["hit"] = round((i0 + int(k)) / 100, 2) if db[i0 + int(k)] > floor + 20 else p["on"]
        p.pop("first_s"); p.pop("last_s")
    return out, round(floor, 1)


def whisper_text(audio, sr, silence):
    rec = so.OfflineRecognizer.from_whisper(
        encoder=str(WHISPER / "small.en-encoder.onnx"), decoder=str(WHISPER / "small.en-decoder.onnx"),
        tokens=str(WHISPER / "small.en-tokens.txt"), language="en", task="transcribe", num_threads=4)
    dur = len(audio) / sr; regions, prev = [], 0.0
    for s in silence:
        if s["start"] - prev > 0.15: regions.append((max(0, prev - 0.25), s["start"] + 0.25))
        prev = s["end"]
    if dur - prev > 0.15: regions.append((max(0, prev - 0.25), dur))
    chunks = []
    for a, b in regions:
        while b - a > 28:  # whisper window
            chunks.append((a, a + 28)); a += 28
        chunks.append((a, b))
    out = []
    for a, b in chunks:
        st = rec.create_stream(); st.accept_waveform(sr, audio[int(a * sr):int(b * sr)]); rec.decode_stream(st)
        txt = re.sub(r"\[[^\]]*(\]|$)|\([^)]*\)", "", st.result.text).strip()
        if txt: out.append({"start": round(a, 2), "end": round(b, 2), "text": txt})
    return out


def wrap(text, width=42):
    lines, line = [], ""
    for tok in text.split():
        cand = f"{line} {tok}".strip()
        if line and len(cand) > width: lines.append(line); line = tok
        else: line = cand
    return lines + ([line] if line else [])


def main(project, use_whisper=True):
    P = Path(project); T = P / "transcript"; T.mkdir(exist_ok=True)
    audio, sr = sf.read(P / "work/audio16k.wav", dtype="float32")
    silence = load(P / "work/silence.json")
    raw, raw_text = parakeet_words(audio, sr)
    pats, lx = lexicon()
    words, hits = apply_lexicon(raw, pats)
    db = envelope(audio, sr)
    phrases, floor = phrases_from(words, db)
    save(T / "words.json", words); save(T / "phrases.json", phrases)
    # tools: onset of the phrase when the name opens it, else the word start
    tools = []
    for i, key in hits:
        w = words[i]
        ph = next(p for p in phrases if w["w"] in p["words"] and p["on"] - 0.3 <= w["s"] <= p["off"] + 0.1)
        at = ph["hit"] if ph["words"][0] == w["w"] else w["s"]
        tools.append({"tool": lx[key]["name"], "key": key, "kind": lx[key]["kind"], "at": round(at, 2),
                      "heard_as": w.get("was", w["w"]), "phrase": ph["text"]})
    save(T / "tools.json", tools)
    md = ["| # | Tool | Source time | Heard as | Phrase |", "|---|---|---|---|---|"]
    md += [f"| {n+1} | {t['tool']} | {ts(t['at'], '.')} | {t['heard_as']} | {t['phrase']} |" for n, t in enumerate(tools)]
    (T / "tools.md").write_text("\n".join(md) + "\n")
    # cross-check
    dis = []
    if use_whisper and WHISPER.exists():
        wh = whisper_text(audio, sr, silence)
        save(T / "whisper.json", wh)
        wwords = [x for c in wh for x in c["text"].split()]
        wcorr, _ = apply_lexicon([{"w": x, "s": 0, "e": 0} for x in wwords], pats)
        a = [norm(w["w"]) for w in words]; b = [norm(w["w"]) for w in wcorr]
        for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
            if op != "equal":
                at = words[min(i1, len(words) - 1)]["s"]
                dis.append({"at": round(at, 2), "parakeet": " ".join(w["w"] for w in words[i1:i2]),
                            "whisper": " ".join(w["w"] for w in wcorr[j1:j2]), "op": op})
    save(T / "disagreements.json", dis)
    # transcript files (source timeline)
    lines, srt, vtt, tsv = [], [], ["WEBVTT", ""], ["start\tend\ttext"]
    for n, p in enumerate(phrases):
        lines.append(f"[{ts(p['on'], '.')}]  {p['text']}")
        body = "\n".join(wrap(p["text"])[:2]) if len(wrap(p["text"])) <= 2 else p["text"]
        srt.append(f"{n+1}\n{ts(p['on'])} --> {ts(p['off'])}\n{body}\n")
        vtt.append(f"{ts(p['on'], '.')} --> {ts(p['off'], '.')}\n{body}\n")
        tsv.append(f"{int(p['on']*1000)}\t{int(p['off']*1000)}\t{p['text']}")
    clean = " ".join(p["text"] for p in phrases)
    (T / "source.txt").write_text("\n".join(lines) + "\n\nClean text:\n\n" + clean + "\n")
    (T / "source.srt").write_text("\n".join(srt)); (T / "source.vtt").write_text("\n".join(vtt))
    (T / "source.tsv").write_text("\n".join(tsv) + "\n")
    save(T / "source.json", {"engine": "sherpa-onnx " + so.__version__ + " / parakeet-tdt-0.6b-v2-int8 (+ whisper small.en cross-check)",
                             "noise_floor_db": floor, "raw_parakeet": raw_text, "text": clean,
                             "phrases": phrases, "words": words, "tools": tools, "disagreements": dis})
    print(f"{len(words)} words, {len(phrases)} phrases, {len(tools)} tool mentions, {len(dis)} model disagreements")
    for t in tools: print(f"  {ts(t['at'], '.')}  {t['tool']:<14} heard as '{t['heard_as']}'")
    for d in dis: print(f"  REVIEW {ts(d['at'], '.')}  parakeet '{d['parakeet']}'  whisper '{d['whisper']}'")


if __name__ == "__main__":
    main(sys.argv[1], "--no-whisper" not in sys.argv)
