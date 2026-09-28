"""Timeline maths shared by the build, insert, verify and deliver steps."""
import re, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load, save, apply_text_corrections

WIPE_COVER = 0.22   # outgoing visual stays under an incoming wipe this long


def build(project):
    P = Path(project)
    plan = load(P / "reel.json")
    segs, t = [], 0.0
    for s in plan["segments"]:
        d = round(s["out"] - s["in"], 4)
        segs.append({**s, "text": apply_text_corrections(s["text"], plan.get("corrections")), "t0": round(t, 4), "t1": round(t + d, 4)})
        t += d
    dur = round(t, 3)
    phrases = load(P / "transcript/phrases.json")
    words = load(P / "transcript/words.json")
    # speaker corrections at word level (e.g. "Hey," "I" -> "AI")
    for c in plan.get("corrections", []):
        src, dst = c["from"].split(), c["to"]
        for i in range(len(words) - len(src) + 1):
            if [w["w"] for w in words[i:i + len(src)]] == src:
                words[i:i + len(src)] = [{"w": dst, "s": words[i]["s"], "e": words[i + len(src) - 1]["e"]}]
                break
    mapped = []
    for w in words:
        seg = next((s for s in segs if s["in"] - 0.15 <= w["s"] < s["out"]), None)
        if seg is None:
            continue   # word was cut
        s0 = max(w["s"], seg["in"]); e0 = min(w["e"], seg["out"])
        mapped.append({"w": w["w"], "src": w["s"], "t": round(seg["t0"] + s0 - seg["in"], 3), "te": round(seg["t0"] + e0 - seg["in"], 3)})
    # voiced time of each segment's first phrase ("hit"), in reel time
    for s in segs:
        ph = phrases[s["phrases"][0]] if s.get("phrases") else None
        hit = ph["hit"] if ph else s["in"] + 0.05
        s["hit_t"] = round(s["t0"] + max(0, hit - s["in"]), 3)
    tools = plan["tools"]
    wins = []
    for k, tl in enumerate(tools):
        a, b = segs[tl["seg"]]["t0"], segs[tl["until_seg"]]["t1"]
        nxt = tools[k + 1] if k + 1 < len(tools) else None
        wipe_next = bool(nxt and nxt["treatment"].startswith("full") and abs(segs[nxt["seg"]]["t0"] - b) < 0.01)
        wins.append({"key": tl["key"], "name": tl["name"], "treatment": tl["treatment"], "in": round(a, 3), "out": round(b, 3),
                     "hold": round(b + WIPE_COVER, 3) if wipe_next else round(b, 3), "voiced": segs[tl["seg"]]["hit_t"]})
    recap = plan.get("recap")
    rwin = None
    if recap:
        rwin = {"in": segs[recap["seg"]]["t0"], "out": segs[recap["until_seg"]]["t1"],
                "line": segs[recap["line_seg"]]["hit_t"], "voiced": segs[recap["seg"]]["hit_t"]}
    tl_ = {"duration": dur, "segments": segs, "words": mapped, "windows": wins, "recap": rwin}
    save(P / "build/timeline.json", tl_)
    return plan, tl_
