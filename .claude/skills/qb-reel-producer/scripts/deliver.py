#!/usr/bin/env python3
"""Write the deliverables for a verified render.

  deliver.py <project dir> <render.mp4>

deliverables/: <slug>.mp4 (faststart), transcript.txt, transcript.json, captions.srt, captions.vtt,
tools-and-edit-map.md, edit-map.json, ASSETS.md, <slug>-project.zip (editable, renders as-is; the raw
source video and raw screen recordings are left out to stay under the 30 MB chat upload limit).
Formats follow references/example-five-tools/.
"""
import re, subprocess, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load, save, ts, ff, apply_text_corrections
import timeline_lib

FORMAT = {"split-left": "Split screen, speaker on the right", "split-right": "Split screen, speaker on the left",
          "full+pip": "Full-screen B-roll + speaker picture-in-picture", "full": "Full-screen B-roll"}


def main(project, render):
    P = Path(project); D = P / "deliverables"; D.mkdir(exist_ok=True)
    plan, tl = timeline_lib.build(P)
    slug = re.sub(r"[^a-z0-9]+", "-", ("qb-" + plan.get("title", P.name)).lower()).strip("-")
    corr = plan.get("corrections")
    ff("-i", render, "-c", "copy", "-movflags", "+faststart", D / f"{slug}.mp4")
    # share copy under the 30 MB chat limit: two-pass H.264 sized to ~28 MB (~3.5-8 Mbps is normal for Reels)
    master = D / f"{slug}.mp4"
    if master.stat().st_size > 29e6:
        kbps = int(28e6 * 8 / 1000 / tl["duration"]) - 192
        share = D / f"{slug}-share.mp4"
        common = ["-c:v", "libx264", "-preset", "slow", "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 1.5)}k", "-bufsize", f"{kbps * 2}k",
                  "-pix_fmt", "yuv420p", "-passlogfile", str(D / "x264pass")]
        ff("-i", master, *common, "-pass", "1", "-an", "-f", "mp4", "/dev/null")
        ff("-i", master, *common, "-pass", "2", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", share)
        for f in D.glob("x264pass*"): f.unlink()
        print(f"share copy {share.name}: {share.stat().st_size / 1e6:.1f} MB at {kbps} kbps")
    S, cues = tl["segments"], plan["cues"]
    srt, vtt = [], ["WEBVTT", ""]
    for n, c in enumerate(cues):
        st = lambda c: c["lines"][0].get("t_at") if c["lines"][0].get("t_at") is not None else S[c["lines"][0]["seg"]]["t0"]
        a = st(c); b = st(cues[n + 1]) if n + 1 < len(cues) else tl["duration"]
        body = "\n".join(apply_text_corrections(l["text"], corr).replace("*", "") for l in c["lines"])
        srt.append(f"{n + 1}\n{ts(a)} --> {ts(b)}\n{body}\n"); vtt.append(f"{ts(a, '.')} --> {ts(b, '.')}\n{body}\n")
    (D / "captions.srt").write_text("\n".join(srt)); (D / "captions.vtt").write_text("\n".join(vtt))
    src = load(P / "transcript/source.json")
    lines = [f"QUIET BANDS · {plan.get('title', '')} · transcript", "", "Timestamps are in the finished reel. Source times are from the original recording.", ""]
    lines += [f"[{ts(s['hit_t'], '.')[3:]}]  {s['text']}    (source {s['in']:.2f}s)" for s in S]
    lines += ["", "Clean text:", "", " ".join(s["text"] for s in S), ""]
    (D / "transcript.txt").write_text("\n".join(lines))
    save(D / "transcript.json", {"duration": tl["duration"], "engine": src["engine"],
                                 "segments": [{"start": s["t0"], "end": s["t1"], "text": s["text"], "source_in": s["in"], "source_out": s["out"]} for s in S],
                                 "words": tl["words"], "corrections": plan.get("corrections", []), "model_disagreements": src["disagreements"]})
    man = load(P / "asset-manifest.json")
    em = {"duration": tl["duration"], "tools": [], "recap": tl["recap"]}
    rows = ["# Tools mentioned and edit map", "", (lambda n, b: f"{n} named tool{'s' if n != 1 else ''}" + (", plus story B-roll." if b else "."))(len({w['key'] for w in tl['windows'] if w.get('kind') != 'broll'}), any(w.get('kind') == 'broll' for w in tl['windows'])), "",
            "| Tool | Said at (reel) | Said at (source) | Visual on screen | Treatment | Visual used |", "|---|---|---|---|---|---|"]
    for tool, w in zip(plan["tools"], tl["windows"]):
        seg = S[tool["seg"]]; vis = man["tools"].get(tool["key"], {}).get("visual") or tool["visual"]
        src_t = seg["in"] + (w["voiced"] - seg["t0"])
        desc = f"{vis.get('source')} ({'moving' if vis['kind'] == 'footage' else 'still mark'})"
        name = tool["name"] + (" (story B-roll)" if tool.get("kind") == "broll" else "")
        rows.append(f"| {name} | {w['voiced']:.2f}s | {src_t:.2f}s | {w['in']:.2f}–{w['out']:.2f}s | {FORMAT[tool['treatment']]} | {desc} |")
        em["tools"].append({"tool": tool["name"], "spoken_at_reel": w["voiced"], "spoken_at_source": round(src_t, 2), "visual_in": w["in"],
                            "visual_out": w["out"], "hold_under_wipe": w["hold"], "format": tool["treatment"], "visual": vis.get("source")})
    if tl["recap"]:
        rows += ["", f"Recap {tl['recap']['in']:.2f}–{tl['recap']['out']:.2f}s: marks stacked, speaker picture-in-picture, orange rule on the payoff line."]
    rows += ["", "Each visual switches on the cut, about 50 ms before the name is voiced. When the next shot is a wipe, the outgoing visual stays underneath for the 0.22 s wipe."]
    (D / "tools-and-edit-map.md").write_text("\n".join(rows) + "\n"); save(D / "edit-map.json", em)
    probe = load(P / "work/probe.json")
    a = ["# Asset and source list", "", "| Asset | Used for | Source | Owner | License / terms |", "|---|---|---|---|---|",
         f"| {Path(probe['original']).name} ({probe['width']}×{probe['height']}, {probe['duration']:.1f}s, sha256 {probe['sha256'][:12]}) | Talking head, all dialogue | Speaker's upload | Speaker | Owned |"]
    for key, t in man["tools"].items():
        v = t["visual"]
        if v["kind"] == "footage":
            win = f" {v.get('start', 0)}–{v.get('end') or 'end'}s"
            a.append(f"| {t['name']} footage{win} | {t['name']} B-roll | {v['source']} | {v['owner']} | {v['license']} |")
        a.append(f"| {t['name']} mark | {('Split screen' + (' and recap' if tl['recap'] else '')) if v['kind'] == 'mark' else ('Recap' if tl['recap'] else 'Not shown')} | {t['mark']['source']} | {t['mark']['owner']} | {t['mark']['license']} |")
    for tool in plan["tools"]:
        if tool.get("kind") == "broll":
            v = tool["visual"]
            a.append(f"| {tool['name']} {v.get('start', 0)}–{v.get('end') or 'end'}s | Story B-roll | {v.get('source')} | {v.get('owner')} | {v.get('license')} |")
    for s in man["shared"].values():
        a.append(f"| {s['file']} | Composition | {s['source']} | {s['owner']} | {s['license']} |")
    mus = plan.get("audio", {}).get("music")
    if mus: a.append(f"| music.wav | Music bed | {'Original, synthesized by make_music.py' if mus.get('kind') == 'synth' else mus.get('file')} | {'Speaker' if mus.get('kind') == 'synth' else 'see licence'} | {'Owned' if mus.get('kind') == 'synth' else 'record the licence here'} |")
    a += ["", f"Transcription ran locally: {src['engine']}. No paid API."]
    (D / "ASSETS.md").write_text("\n".join(a) + "\n")
    z = D / f"{slug}-project.zip"
    skip = re.compile(r"^(renders|verify|deliverables|work)/|^build/(voice_raw|music_raw)|assets/media/(source\.|rec-)")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in P.rglob("*"):
            rel = f.relative_to(P).as_posix()
            if f.is_file() and not skip.search(rel): zf.write(f, f"{slug}/{rel}")
    mb = z.stat().st_size / 1e6
    print(f"deliverables in {D}  (project zip {mb:.1f} MB{' - over the 30 MB chat limit' if mb > 30 else ''})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
