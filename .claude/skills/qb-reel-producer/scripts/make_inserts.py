#!/usr/bin/env python3
"""Build moving B-roll inserts at exact 1080x1920 / 30 fps (one lanczos scale each).

Footage visual fields (reel.json tools[].visual): src, start, end, crop (ffmpeg w:h:x:y), rate (optional).
If the clean window [start, end] is shorter than the slot, the clip is slowed down to 0.75x at most;
below that the step fails and the window must be widened or the treatment changed."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ff, duration, resolve, W, H, FPS
import timeline_lib


def main(project):
    P = Path(project)
    plan, tl = timeline_lib.build(P)
    for tool, win in zip(plan["tools"], tl["windows"]):
        v = tool["visual"]
        if v["kind"] != "footage":
            continue
        need = win["hold"] - win["in"] + 0.1
        src = resolve(P, v["src"])
        start = float(v.get("start") or 0); end = float(v.get("end") or duration(src))
        rate = float(v.get("rate", 1.0))
        avail = (end - start) / rate
        if avail < need:
            rate = (end - start) / need
            if rate < 0.75:
                sys.exit(f"{tool['name']}: clean window {end-start:.2f}s is too short for a {need:.2f}s slot even at 0.75x")
            print(f"{tool['name']}: slowed to {rate:.2f}x to fill {need:.2f}s")
        take = min(end - start, need * rate + 0.05)
        vf = (f"setpts=PTS/{rate:.4f},{v['filter']},fps={FPS},format=yuv420p" if v.get("filter") else
              f"setpts=PTS/{rate:.4f},crop={v['crop']},scale={W}:{H}:flags=lanczos,fps={FPS},format=yuv420p")
        out = P / f"assets/media/ins-{tool['key']}.mp4"
        ff("-ss", f"{start:.3f}", "-t", f"{take:.3f}", "-i", src, "-vf", vf, "-an", "-c:v", "libx264", "-crf", "12", "-g", "30", "-keyint_min", "30", out)
        v["clip"] = str(out.relative_to(P))
        print(f"{tool['name']:<12} {out.name}  {duration(out):.2f}s for a {need:.2f}s slot")
    from common import save
    save(P / "reel.json", plan)


if __name__ == "__main__":
    main(sys.argv[1])
