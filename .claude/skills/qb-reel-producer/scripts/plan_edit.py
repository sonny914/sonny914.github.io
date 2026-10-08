#!/usr/bin/env python3
"""Step 4: draft the edit plan (reel.json) from the verified transcript and the asset manifest.

  plan_edit.py <project dir>

The draft encodes the rules that produced the reference reel (references/example-five-tools):
- Cut on measured speech runs; lead-in 0.05 s; pauses kept after a phrase: tool name 0.14 s,
  comma 0.16 s, full stop 0.26 s, question 0.30 s, ending hold 0.9 s. Phrases < 0.25 s apart stay joined.
- Every tool mention gets a visual that switches on the cut (~50 ms before the name is voiced)
  and ends when the explanation ends, never after the subject changes.
- Visual priority per tool: the speaker's own recording > official moving demo > official mark.
- Treatments rotate: footage -> full+pip / full; mark -> split-left / split-right; no repeats in a row.
- A recap is drafted when a phrase after the last tool says "stack", "toolkit", "setup" or "workflow".
- Captions: <= 2 balanced lines, tool-name + function pairs share one cue, orange on tool names,
  number phrases ("five different tools", "one job") and reel.json "emphasis" words.
Everything here is a draft: review it, edit reel.json, then `qb_reel.py rebuild`.
"""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load, save, snap, apply_text_corrections

NUM = r"(one|two|three|four|five|six|seven|eight|nine|ten|\d+)"
PAUSE = {"tool": 0.14, ",": 0.16, ".": 0.26, "?": 0.30, "!": 0.26, "": 0.22}
RECAP_WORDS = re.compile(r"\b(stack|toolkit|tool kit|setup|set up|workflow)\b", re.I)


def emphasize(text, tools, extra):
    """Orange (*...*) on tool names, a number phrase that ends the line ("five different tools?",
    "one job."), and the reel's emphasis words. Everything else stays cream."""
    out = text
    for name in sorted(tools, key=len, reverse=True):
        out = re.sub(rf"(?<![*\w])({re.escape(name)}[,.?!]?)", r"*\1*", out)
    out = re.sub(rf"(?<![*\w])(\b{NUM}\b(?:\s+[A-Za-z']+){{1,2}}[?.!]?)$", r"*\1*", out, flags=re.I)
    for w in extra:
        out = re.sub(rf"(?<![*\w])(\b{re.escape(w)}\b[,.?!]?)", r"*\1*", out)
    return out.replace("**", "")


def chunk_words(ws, limit):
    """Split a long phrase into caption chunks of <= limit characters at the most balanced natural
    break: after punctuation or before a conjunction scores best, then equal length."""
    text = lambda xs: " ".join(x["w"] for x in xs)
    if len(text(ws)) <= limit or len(ws) < 2:
        return [ws]
    best = None
    for k in range(1, len(ws)):
        a, b = text(ws[:k]), text(ws[k:])
        score = abs(len(a) - len(b))
        if re.search(r"[,;:.]$", ws[k - 1]["w"]): score -= 14
        if ws[k]["w"].lower() in ("and", "but", "or", "so", "then", "like", "because", "casually", "to"): score -= 8
        if best is None or score < best[0]: best = (score, k)
    k = best[1]
    return chunk_words(ws[:k], limit) + chunk_words(ws[k:], limit)


def main(project):
    P = Path(project)
    phrases = load(P / "transcript/phrases.json")
    manifest = load(P / "asset-manifest.json")
    prev = load(P / "reel.json") if (P / "reel.json").exists() else {}
    emphasis = prev.get("emphasis", ["AI", "stack"])
    corrections = prev.get("corrections", [])
    # 1. segments (join phrases closer than 0.25 s into one continuous segment)
    groups = []
    for i, p in enumerate(phrases):
        if groups and p["on"] - phrases[groups[-1][-1]]["off"] < 0.25:
            groups[-1].append(i)
        else:
            groups.append([i])
    segs = []
    for n, g in enumerate(groups):
        first, last = phrases[g[0]], phrases[g[-1]]
        mark = last["text"][-1] if last["text"][-1] in ",.?!" else ""
        is_tool = bool(last["tools"]) and len(last["words"]) <= 3
        pause = 0.9 if n == len(groups) - 1 else (PAUSE["tool"] if is_tool else PAUSE[mark])
        start = max(first["on"], first.get("hit", first["on"]) - 0.2)   # ignore breath/noise before a late onset
        segs.append({"text": apply_text_corrections(" ".join(phrases[i]["text"] for i in g), corrections), "phrases": g,
                     "in": snap(max(0, start - 0.05)), "out": snap(last["off"] + pause),
                     "tools": sorted({t for i in g for t in phrases[i]["tools"]})})
    # 2. tools -> windows, visuals, treatments
    lx = {k: v for k, v in manifest["tools"].items()}
    tools, last_t = [], None
    for si, s in enumerate(segs):
        for key in s["tools"]:
            if key not in lx or lx[key]["kind"] not in ("tool",):
                continue
            name_only = len(s["text"].split()) <= 3
            until = si + 1 if name_only and si + 1 < len(segs) and not segs[si + 1]["tools"] else si
            v = lx[key]["visual"]
            if v["kind"] == "footage":
                pref = ["full+pip", "full"]
            else:
                pref = ["split-left", "split-right"]
            treat = next((t for t in pref if t != last_t and not (tools and tools[-1]["treatment"] == t)), pref[0])
            if tools and tools[-1]["treatment"] == treat: treat = pref[1]
            tools.append({"key": key, "name": lx[key]["name"], "seg": si, "until_seg": until,
                          "treatment": treat, "visual": v})
            last_t = treat
    # story B-roll: the speaker's own clips anchored to a phrase ("use this clip when I say ...")
    for b in prev.get("broll", []):
        si = next((i for i, s in enumerate(segs) if b["match"].lower() in s["text"].lower()), None)
        if si is None:
            print(f"  B-roll '{b['name']}': phrase not found: {b['match']!r}"); continue
        tools.append({"key": b["key"], "name": b["name"], "kind": "broll", "seg": si, "until_seg": si,
                      "start_word": b["match"].split()[0], "treatment": b.get("treatment", "full"),
                      "visual": {"kind": "footage", **{k: b[k] for k in ("src", "start", "end", "filter", "crop", "rate",
                                                                         "source", "owner", "license") if k in b}}})
    tools.sort(key=lambda t: (t["seg"], t.get("kind") == "broll"))
    # the full-screen treatments alternate between full+pip and full
    fulls = [t for t in tools if t["visual"]["kind"] == "footage" and t.get("kind") != "broll"]
    for k, t in enumerate(fulls): t["treatment"] = "full+pip" if k % 2 == 0 else "full"
    splits = [t for t in tools if t["visual"]["kind"] != "footage" and t.get("kind") != "broll"]
    for k, t in enumerate(splits): t["treatment"] = "split-left" if k % 2 == 0 else "split-right"
    # 3. recap
    recap = None
    if len([t for t in tools if t.get("kind") != "broll"]) >= 3:
        after = tools[-1]["until_seg"] + 1
        for si in range(after, len(segs)):
            if RECAP_WORDS.search(segs[si]["text"]):
                end = si
                while end + 1 < len(segs) and end - si < 2 and re.search(r"\b(tools?|job|one|all)\b", segs[end + 1]["text"], re.I):
                    end += 1
                recap = {"seg": si, "line_seg": end, "until_seg": end}
                break
    # 4. captions: tool name + following function line share a cue; long lines split
    allw = load(P / "transcript/words.json")
    words_by_phrase, ptr = [], 0          # phrases are consecutive runs of words.json
    for p in phrases:
        words_by_phrase.append(allw[ptr:ptr + len(p["words"])]); ptr += len(p["words"])
    names = [t["name"] for t in tools if t.get("kind") != "broll"]
    cues, si = [], 0
    while si < len(segs):
        t = next((t for t in tools if t["seg"] == si), None)
        if t and t["until_seg"] == si + 1:
            cues.append({"lines": [{"seg": si, "text": emphasize(segs[si]["text"], names, emphasis)},
                                   {"seg": si + 1, "text": emphasize(segs[si + 1]["text"], names, emphasis)}]}); si += 2; continue
        if recap and si == recap["line_seg"] - 1 and recap["line_seg"] != recap["seg"]:
            cues.append({"lines": [{"seg": si, "text": emphasize(segs[si]["text"], names, emphasis)},
                                   {"seg": si + 1, "text": emphasize(segs[si + 1]["text"], names, emphasis)}]}); si += 2; continue
        nxt_tool = any(t["seg"] == si + 1 for t in tools)
        if (si + 1 < len(segs) and not re.search(r"[.?!]$", segs[si]["text"]) and not nxt_tool
                and len(segs[si]["text"]) <= 32 and len(segs[si + 1]["text"]) <= 32
                and not (recap and si + 1 == recap["seg"])):
            cues.append({"lines": [{"seg": si, "text": emphasize(segs[si]["text"], names, emphasis)},
                                   {"seg": si + 1, "text": emphasize(segs[si + 1]["text"], names, emphasis)}]}); si += 2; continue
        if len(segs[si]["text"]) > 60:   # more than two lines: split into cues at word times
            ws = [w for i in segs[si]["phrases"] for w in words_by_phrase[i]]
            for chunk in chunk_words(ws, 60):
                txt = apply_text_corrections(" ".join(w["w"] for w in chunk), corrections)
                line = {"seg": si, "text": emphasize(txt, names, emphasis)}
                if chunk[0] is not ws[0]: line["src_at"] = chunk[0]["s"]
                cues.append({"lines": [line]})
            si += 1; continue
        cues.append({"lines": [{"seg": si, "text": emphasize(segs[si]["text"], names, emphasis)}]}); si += 1
    # 5. framing: restrained punch-ins on talking-head segments, pivot on the cap line
    covered = set()
    for t in tools:
        if not t.get("start_word"):   # B-roll that starts mid-segment leaves the segment's opening on the face
            covered.update(range(t["seg"], t["until_seg"] + 1))
    if recap: covered.update(range(recap["seg"], recap["until_seg"] + 1))
    pattern = [tuple(x) for x in prev.get("framing", {}).get("punch", [(1.0, 1.035), (1.12, 1.14), (1.02, 1.04), (1.13, 1.15)])]
    moves, k = [], 0
    for i in range(len(segs)):
        if i in covered: continue
        a, b = (1.04, 1.10) if i == len(segs) - 1 else pattern[k % len(pattern)]
        moves.append({"seg": i, "from": a, "to": b}); k += 1
    plan = {
        "title": prev.get("title", P.name), "source": load(P / "work/probe.json")["working"], "fps": 30, "lead": 0.05,
        "emphasis": emphasis, "corrections": corrections,
        "segments": [{k2: v for k2, v in s.items() if k2 != "tools"} for s in segs],
        "cues": cues, "tools": tools, "recap": recap,
        "broll": prev.get("broll", []),
        "framing": {"pivot_y": prev.get("framing", {}).get("pivot_y", 400), "punch": [list(x) for x in pattern],
                    "split_shift": prev.get("framing", {}).get("split_shift", 235),
                    "split_scale": prev.get("framing", {}).get("split_scale", 1.0),
                    "caption_top": prev.get("framing", {}).get("caption_top", 1330), "moves": moves},
        "audio": prev.get("audio", {"voice_lufs": -15, "music": {"kind": "synth", "lufs": -31},
                                     "sfx": {"full": "whoosh", "split": "click", "recap": "pop"}}),
        "font": prev.get("font", "Space Grotesk"),
    }
    save(P / "reel.json", plan)
    dur = sum(s["out"] - s["in"] for s in segs)
    print(f"draft plan: {len(segs)} segments, {dur:.1f}s, {len(tools)} tool visuals, recap: {'yes' if recap else 'no'}, {len(cues)} cues")
    for t in tools:
        print(f"  {t['name']:<12} seg {t['seg']}-{t['until_seg']}  {t['treatment']:<11} {t['visual']['kind']}: {t['visual'].get('file') or t['visual'].get('src')}")


if __name__ == "__main__":
    main(sys.argv[1])
