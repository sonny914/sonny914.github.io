#!/usr/bin/env python3
"""Generate the HyperFrames composition (index.html) from reel.json + build/timeline.json.

Visual system (references/brand-and-motion.md): ink #0b0a09, cream #efe6d2, orange #ff6a1a (interactive /
emphasis only); Space Grotesk 700 captions in a 90% ink plate, lower centre, <= 2 balanced lines;
treatments: split-left / split-right (official mark in an ink column, the speaker slides aside),
full (moving B-roll), full+pip (moving B-roll + speaker picture-in-picture), recap (marks stacked +
large PiP, an orange rule draws on the payoff line). Wipes 0.2-0.24 s power3.out; everything else cuts."""
import html, re, shutil, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import SKILL, load, save, apply_text_corrections, duration
import timeline_lib

FONT_DIR = SKILL.parents[1] / "skills/embedded-captions/modes/standard/fonts/files"


def fmt(text):
    t = html.escape(text).replace("&#x27;", "&#39;")
    return re.sub(r"\*([^*]+)\*", r"<em>\1</em>", t)


def mark_path(P, key):
    svg = (P / f"assets/logos/{key}.svg").read_text()
    return re.search(r'<path[^>]*\sd="([^"]+)"', svg).group(1)


def main(project):
    P = Path(project)
    plan, tl = timeline_lib.build(P)
    S, DUR, wins = tl["segments"], tl["duration"], tl["windows"]
    corr = plan.get("corrections")
    cap_top = plan["framing"].get("caption_top", 1330)
    pivot = plan["framing"].get("pivot_y", 400)
    # fonts + vendor
    (P / "assets/fonts").mkdir(parents=True, exist_ok=True); (P / "assets/vendor").mkdir(parents=True, exist_ok=True)
    for w in ("400", "700"):
        f = FONT_DIR / f"space-grotesk-latin-{w}-normal.woff2"
        if f.exists() and not (P / f"assets/fonts/{f.name}").exists(): shutil.copy2(f, P / "assets/fonts" / f.name)
    gsap = SKILL / "assets/gsap-3.14.2.min.js"
    shutil.copy2(gsap, P / "assets/vendor/gsap-3.14.2.min.js")
    if not (P / "hyperframes.json").exists():
        shutil.copy2(SKILL / "assets/hyperframes.json", P / "hyperframes.json")

    def t0(i): return round(S[i]["t0"], 3)
    def cue_start(c):
        l = c["lines"][0]; return l["t_at"] if l.get("t_at") is not None else t0(l["seg"])
    def t1(i): return round(S[i]["t1"], 3)
    def hit(i): return round(S[i]["hit_t"], 3)

    # captions
    cues = plan["cues"]; cue_html, cue_js = [], []
    for n, cue in enumerate(cues):
        lines = cue["lines"]; start = cue_start(cue)
        stop = cue_start(cues[n + 1]) if n + 1 < len(cues) else DUR
        spans = "".join(f'<span class="ln" id="c{n}l{k}">{fmt(apply_text_corrections(l["text"], corr))}</span>' for k, l in enumerate(lines))
        cue_html.append(f'<div id="cue{n}" class="clip cue" data-start="{start}" data-duration="{round(stop - start, 3)}" data-track-index="20"><div class="plate">{spans}</div></div>')
        for k, l in enumerate(lines):
            at = start if k == 0 else (l["t_at"] if l.get("t_at") is not None else hit(l["seg"]))
            if k > 0:
                cue_js += [f'tl.set("#c{n}l{k}", {{display: "none"}}, 0);', f'tl.set("#c{n}l{k}", {{display: "block"}}, {at});']
            cue_js.append(f'tl.fromTo("#c{n}l{k}", {{opacity: {0.45 if k == 0 else 0}, y: 8}}, {{opacity: 1, y: 0, duration: 0.14, ease: "power2.out"}}, {at});')

    def label(name, extra=""):
        return f'<div class="label {extra}"><i></i><span>{html.escape(name)}</span></div>'

    ins_html, ins_js, sfx = [], [], []
    sfx_map = plan.get("audio", {}).get("sfx", {"full": "whoosh", "split": "click", "recap": "pop"})
    pip_windows = []
    for n, (tool, w) in enumerate(zip(plan["tools"], wins)):
        key, a, b, hold, form = f'{tool["key"]}{n}', w["in"], w["out"], w["hold"], tool["treatment"]
        if form.startswith("split"):
            side = "left" if form == "split-left" else "right"
            shift = plan["framing"].get("split_shift", 235)   # how far the speaker slides aside
            split_scale = plan["framing"].get("split_scale", 1.0)  # < 1 keeps a close face whole beside the column
            dx = shift if side == "left" else -shift
            clip0 = "inset(0 100% 0 0)" if side == "left" else "inset(0 0 0 100%)"
            ins_html.append(f'<div id="col-{key}" class="col {side}"><div class="col-inner"><svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="{mark_path(P, tool["key"])}"/></svg>{label(tool["name"])}</div></div>')
            ins_js += [f'tl.set("#col-{key}", {{opacity: 1}}, {a});',
                       f'tl.fromTo("#col-{key}", {{clipPath: "{clip0}"}}, {{clipPath: "inset(0 0% 0 0%)", duration: 0.24, ease: "power3.out"}}, {a});',
                       f'tl.set("#aroll-wrap", {{transformOrigin: "540px 0px"}}, {a});',
                       f'tl.fromTo("#aroll-wrap", {{x: 0, scale: 1}}, {{x: {dx}, scale: {split_scale}, duration: 0.28, ease: "power3.out", immediateRender: false}}, {a});',
                       f'tl.fromTo("#col-{key} .mark", {{scale: 0.94}}, {{scale: 1, duration: {round(b - a, 2)}, ease: "sine.out"}}, {a});',
                       f'tl.fromTo("#col-{key} .label", {{opacity: 0, x: {-16 if side == "left" else 16}}}, {{opacity: 1, x: 0, duration: 0.2, ease: "power2.out"}}, {round(a + 0.12, 3)});',
                       f'tl.set("#col-{key}", {{opacity: 0}}, {hold});', f'tl.set("#aroll-wrap", {{x: 0, scale: 1, transformOrigin: "540px {pivot}px"}}, {hold});']
            sfx.append((sfx_map.get("split"), a, 0.3))
        else:
            clip = tool["visual"]["clip"]; d = round(hold - a, 3)
            ins_html.append(f'<div id="ins-{key}-wrap" class="ins"><video id="ins-{key}" class="clip" src="{clip}" data-start="{a}" data-duration="{d}" data-track-index="2" muted playsinline></video>{"" if tool.get("kind") == "broll" else label(tool["name"], "on-full")}</div>')
            ins_js += [f'tl.set("#ins-{key}-wrap", {{opacity: 1}}, {a});',
                       f'tl.fromTo("#ins-{key}-wrap", {{clipPath: "inset(0 0 100% 0)"}}, {{clipPath: "inset(0 0 0% 0)", duration: 0.2, ease: "power3.out"}}, {a});',
                       f'tl.fromTo("#ins-{key}-wrap video", {{scale: 1.0}}, {{scale: 1.05, duration: {d}, ease: "none"}}, {a});',
                       *([] if tool.get("kind") == "broll" else [f'tl.fromTo("#ins-{key}-wrap .label", {{opacity: 0, y: 12}}, {{opacity: 1, y: 0, duration: 0.2, ease: "power2.out"}}, {round(a + 0.1, 3)});']),
                       f'tl.set("#ins-{key}-wrap", {{opacity: 0}}, {hold});']
            sfx.append((sfx_map.get("full"), round(a - 0.06, 3), 0.55))
            if form == "full+pip":
                pip_windows.append((a, b))
                ins_js += [f'tl.set("#pip", {{className: "pip small"}}, {a});',
                           f'tl.fromTo("#pip", {{opacity: 0, scale: 0.9}}, {{opacity: 1, scale: 1, duration: 0.22, ease: "power3.out", immediateRender: false}}, {round(a + 0.12, 3)});',
                           f'tl.set("#pip", {{opacity: 0}}, {b});']
    # recap
    recap_html, recap_js, rw = "", [], tl["recap"]
    if rw:
        seen, rows = set(), []
        for tool in plan["tools"]:
            if tool["key"] in seen or tool.get("kind") == "broll": continue
            seen.add(tool["key"]); rows.append(tool)
        rows_html = "".join(f'<div class="row" id="row{i}"><svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="{mark_path(P, t["key"])}"/></svg><span>{html.escape(t["name"])}</span></div>' for i, t in enumerate(rows))
        recap_html = f'<div id="recap"><div id="stack"><div id="stackline" style="height:{len(rows) * 132 - 36}px"></div>{rows_html}</div></div>'
        rs = rw["voiced"]
        recap_js = [f'tl.set("#recap", {{opacity: 1}}, {rw["in"]});', f'tl.set("#aroll-wrap", {{opacity: 0}}, {rw["in"]});',
                    f'tl.set("#pip", {{opacity: 1, className: "pip big"}}, {rw["in"]});']
        recap_js += [f'tl.fromTo("#row{i}", {{opacity: 0, x: -24}}, {{opacity: 1, x: 0, duration: 0.22, ease: "power3.out"}}, {round(rs + 0.03 + i * 0.09, 3)});' for i in range(len(rows))]
        recap_js += [f'tl.fromTo("#stackline", {{scaleY: 0}}, {{scaleY: 1, duration: 0.42, ease: "power2.inOut"}}, {rw["line"]});',
                     f'tl.set("#recap", {{opacity: 0}}, {rw["out"]});', f'tl.set("#pip", {{opacity: 0}}, {rw["out"]});',
                     f'tl.set("#aroll-wrap", {{opacity: 1}}, {rw["out"]});']
        sfx.append((sfx_map.get("recap"), round(rs + 0.02, 3), 0.45))
        pip_windows.append((rw["in"], rw["out"]))
    # framing
    frame_js, last_scale = [], None
    covered = set()
    for tool in plan["tools"]: covered.update(range(tool["seg"], tool["until_seg"] + 1))
    for m in plan["framing"]["moves"]:
        i = m["seg"]
        frame_js.append(f'tl.fromTo("#aroll-wrap", {{scale: {m["from"]}}}, {{scale: {m["to"]}, duration: {round(t1(i) - t0(i), 3)}, ease: "none", immediateRender: {"true" if i == 0 else "false"}}}, {t0(i)});')
    for tool in plan["tools"]:
        if tool["treatment"].startswith("split"):
            frame_js.append(f'tl.set("#aroll-wrap", {{scale: 1.0}}, {t0(tool["seg"])});')
    # audio
    audio_html = [f'<audio id="voice" src="assets/audio/voice.wav" data-start="0" data-duration="{DUR}" data-track-index="10" data-volume="1"></audio>']
    if (P / "assets/audio/music.wav").exists():
        audio_html.append(f'<audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="{DUR}" data-track-index="11" data-volume="1"></audio>')
    for i, (name, at, vol) in enumerate(s for s in sfx if s[0]):
        f = f"assets/audio/sfx-{name}.wav"
        if (P / f).exists():
            audio_html.append(f'<audio id="sfx{i}" src="{f}" data-start="{max(0, at)}" data-duration="{round(duration(P / f), 3)}" data-track-index="{12 + i}" data-volume="{vol}"></audio>')
    pip_html = ""
    if pip_windows:
        ps, pe = min(p[0] for p in pip_windows), max(p[1] for p in pip_windows)
        pip_html = f'<div id="pip" class="pip small"><video id="pip-video" class="clip" src="assets/media/aroll.mp4" data-start="{ps}" data-duration="{round(pe - ps, 3)}" data-media-start="{ps}" data-track-index="1" data-layout-allow-overflow muted playsinline></video></div>'
    css = (SKILL / "assets/reel.css").read_text().replace("__CAPTION_TOP__", str(cap_top)).replace("__LABEL_TOP__", str(cap_top - 92)).replace("__PIVOT__", str(pivot))
    page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<title>Quiet Bands · {html.escape(plan.get("title", "reel"))}</title>
<script src="assets/vendor/gsap-3.14.2.min.js"></script>
<style>
{css}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{DUR}" data-width="1080" data-height="1920">
<div id="aroll-wrap"><video id="aroll" class="clip" src="assets/media/aroll.mp4" data-start="0" data-duration="{DUR}" data-track-index="0" muted playsinline></video></div>
{chr(10).join(ins_html)}
{recap_html}
{pip_html}
{chr(10).join(cue_html)}
{chr(10).join(audio_html)}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(frame_js)}
{chr(10).join(ins_js)}
{chr(10).join(recap_js)}
{chr(10).join(cue_js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script>
</body>
</html>
'''
    (P / "index.html").write_text(page)
    print(f"index.html: {DUR:.2f}s, {len(cues)} cues, {len(wins)} tool visuals, recap {'yes' if rw else 'no'}")


if __name__ == "__main__":
    main(sys.argv[1])
