#!/usr/bin/env python3
"""qb-reel-producer entry point.

  qb_reel.py new <video> [--name slug] [--footage "Tool=recording.mp4@start-end" ...]
      prepare -> transcribe -> assets -> plan -> cut -> inserts -> music -> build -> check -> render pass 1 -> verify
  qb_reel.py replan <project>       redo assets + draft plan (keeps corrections/emphasis/framing/audio/font)
  qb_reel.py rebuild <project>      re-run cut/inserts/music/build/check/render/verify after editing reel.json
  qb_reel.py verify <project> [render.mp4]
  qb_reel.py deliver <project> [render.mp4]
Projects live in video/reels/<slug>/ (git-ignored). Renders go to renders/passN.mp4.
"""
import re, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import REELS, SKILL, hyperframes, MODELS, PARAKEET
HERE = Path(__file__).resolve().parent
PY = sys.executable


def step(name, *args):
    print(f"\n== {name}", flush=True)
    subprocess.run([PY, str(HERE / name), *map(str, args)], check=True)


def next_render(P):
    (P / "renders").mkdir(exist_ok=True)
    n = 1 + max([int(m.group(1)) for f in (P / "renders").glob("pass*.mp4") if (m := re.match(r"pass(\d+)", f.stem))] or [0])
    return P / "renders" / f"pass{n}.mp4"


def latest(P):
    rs = sorted((P / "renders").glob("pass*.mp4"), key=lambda f: int(re.match(r"pass(\d+)", f.stem).group(1)))
    return rs[-1] if rs else None


def build_and_render(P):
    for s in ("cut_aroll.py", "make_inserts.py", "make_music.py", "build_composition.py"):
        step(s, P)
    print("\n== hyperframes check")
    hyperframes(P, "check")
    out = next_render(P)
    print(f"\n== render {out.name}")
    hyperframes(P, "render", "--output", str(out))
    ok = subprocess.run([PY, str(HERE / "verify_render.py"), P, out]).returncode == 0
    print(f"\n{'PASS' if ok else 'FAIL'} - now LOOK at {P}/verify/sweep.png, boundaries.png, phone.png; edit {P}/reel.json; run: qb_reel.py rebuild {P}")
    return ok


def main(argv):
    cmd = argv[0]
    if cmd in ("replan", "rebuild", "verify", "deliver") and len(argv) > 1:
        argv = [cmd, str(Path(argv[1]).resolve()), *[str(Path(a).resolve()) for a in argv[2:3]]]
    if cmd == "new":
        video = Path(argv[1]); name = argv[argv.index("--name") + 1] if "--name" in argv else re.sub(r"[^a-z0-9]+", "-", video.stem.lower()).strip("-")
        foot = [argv[i + 1] for i, a in enumerate(argv) if a == "--footage"]
        if not PARAKEET.exists():
            subprocess.run(["bash", str(HERE / "setup_env.sh")], check=True)
        P = (REELS / name).resolve(); P.mkdir(parents=True, exist_ok=True)
        step("prepare_video.py", video, P)
        step("transcribe.py", P)
        step("asset_inventory.py", P, *[x for f in foot for x in ("--footage", f)])
        step("plan_edit.py", P)
        print(f"\nREVIEW BEFORE TRUSTING THE DRAFT: {P}/transcript/disagreements.json, tools.md, work/grid.png, work/broll-*.png")
        build_and_render(P)
    elif cmd == "replan":   # re-run assets + draft plan; keeps corrections, emphasis, framing, audio, font from reel.json
        P = Path(argv[1]); step("asset_inventory.py", P); step("plan_edit.py", P)
    elif cmd == "rebuild":
        build_and_render(Path(argv[1]))
    elif cmd == "verify":
        P = Path(argv[1]); subprocess.run([PY, str(HERE / "verify_render.py"), P, argv[2] if len(argv) > 2 else latest(P)])
    elif cmd == "deliver":
        P = Path(argv[1]); step("deliver.py", P, argv[2] if len(argv) > 2 else latest(P))
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:] or ["help"])
