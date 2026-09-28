#!/usr/bin/env python3
"""Step 3: choose a real visual for every named tool and record where each asset came from.

  asset_inventory.py <project dir> [--footage "Tool=path/to/recording.mp4@start-end" ...]

Priority per tool (never an invented interface):
  1. the speaker's own screen recording (--footage); a B-roll inspection sheet is written to
     work/broll-<key>.png so notifications, private URLs, Control Center frames and unrelated text
     can be excluded by adjusting start/end/crop in reel.json
  2. an official moving demonstration from the shared library (video/qb-assets), fetched once
  3. the official product mark from the shared library, fetched once from npm (simple-icons CC0,
     @lobehub/icons-static-svg MIT) and rendered in QB cream
  4. otherwise: kind "missing" - the plan skips the visual and the report asks for footage
Writes <project>/asset-manifest.json and copies marks into assets/logos/<key>.svg.
The shared library keeps official assets only; personal recordings stay inside the (git-ignored) reel project.
"""
import re, shutil, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import SKILL, CACHE, ASSET_LIB, load, save, ff, duration, probe

LEX = load(SKILL / "references/tool-lexicon.json")["tools"]


def npm_icon(pkg, slug):
    root = CACHE / "npm" / pkg.replace("/", "__")
    icon = root / "package/icons" / f"{slug}.svg"
    if not icon.exists():
        root.mkdir(parents=True, exist_ok=True)
        tgz = subprocess.run(["npm", "pack", pkg, "--silent"], cwd=root, capture_output=True, text=True, check=True).stdout.strip().splitlines()[-1]
        subprocess.run(["tar", "xzf", tgz], cwd=root, check=True)
    version = load(root / "package/package.json")["version"]
    lic = {"simple-icons": "CC0-1.0 (collection); mark is a trademark of its owner, used to identify the product",
           "@lobehub/icons-static-svg": "MIT (package); mark is a trademark of its owner, used to identify the product"}[pkg]
    return icon, f"npm {pkg}@{version} icons/{slug}.svg", lic


def library(key):
    man = ASSET_LIB / "manifest.json"
    return (load(man) if man.exists() else {"tools": {}}), man


def ensure_mark(key):
    lib, man = library(key)
    entry = lib["tools"].setdefault(key, {"name": LEX[key]["name"]})
    dst = ASSET_LIB / "tools" / key / "mark.svg"
    if not (entry.get("mark") and dst.exists()):
        icon, source, lic = npm_icon(LEX[key]["logo"]["pkg"], LEX[key]["logo"]["slug"])
        dst.parent.mkdir(parents=True, exist_ok=True); shutil.copy2(icon, dst)
        entry["mark"] = {"file": f"tools/{key}/mark.svg", "source": source, "owner": "official (product owner)", "license": lic}
        save(man, lib); print(f"  fetched once and cached: {key} mark ({source})")
    return lib["tools"][key]["mark"]


def ensure_demo(key):
    spec = LEX[key].get("footage")
    if not spec: return None
    lib, man = library(key)
    entry = lib["tools"].setdefault(key, {"name": LEX[key]["name"]})
    dst = ASSET_LIB / "tools" / key / "demo.mp4"
    if not (entry.get("demo") and dst.exists()):
        repo = spec["repo"].rstrip("/"); slug = repo.split("github.com/")[1]
        clone = CACHE / "git" / slug.replace("/", "__")
        if not clone.exists():
            subprocess.run(["git", "clone", "-q", "--depth", "1", repo, str(clone)], check=True,
                           env={**__import__("os").environ, "GIT_LFS_SKIP_SMUDGE": "1"})
        sha = subprocess.run(["git", "-C", str(clone), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        dst.parent.mkdir(parents=True, exist_ok=True)
        ff("-i", clone / spec["path"], "-vf", f"{spec['prep']},format=yuv420p", "-an", "-c:v", "libx264", "-crf", "16", "-g", "10", dst)
        entry["demo"] = {"file": f"tools/{key}/demo.mp4", "source": f"{repo} {spec['path']} @ {sha[:12]}",
                         "owner": "official (product owner)", "license": "Official public product demo; " + spec.get("note", ""),
                         "reel_defaults": spec.get("reel_defaults", {})}
        save(man, lib); print(f"  fetched once and cached: {key} demo ({entry['demo']['source']})")
    return lib["tools"][key]["demo"]


def phone_crop(w, h):
    """9:16 window; for tall phone recordings drop the status bar (~5 %)."""
    if h / w > 16 / 9 + 0.01:
        ch = round(w * 16 / 9); y = min(round(h * 0.05), h - ch)
        return f"{w}:{ch}:0:{y}"
    cw = round(h * 9 / 16); return f"{cw}:{h}:{(w - cw) // 2}:0"


def main(project, footage_args):
    P = Path(project)
    tools = load(P / "transcript/tools.json")
    fj = P / "work/footage.json"
    if footage_args: save(fj, footage_args)
    elif fj.exists(): footage_args = load(fj)
    footage = {}
    for arg in footage_args:
        m = re.match(r"(.+?)=(.+?)(?:@([\d.]+)-([\d.]+))?$", arg)
        name, path, a, b = m.groups()
        key = next((k for k, t in LEX.items() if name.lower() in (k, t["name"].lower(), *t["aliases"])), None)
        if not key: sys.exit(f"--footage: unknown tool '{name}' (add it to references/tool-lexicon.json)")
        footage[key] = (Path(path), float(a) if a else None, float(b) if b else None)
    manifest = {"tools": {}, "shared": {
        "font": {"file": "Space Grotesk 400/700", "source": "HyperFrames skills bundle", "owner": "third party", "license": "SIL Open Font License"},
        "sfx": {"file": "sfx-whoosh/click/pop", "source": "HyperFrames media-use skill (Pixabay)", "owner": "third party", "license": "Pixabay Content License, no attribution required"},
        "gsap": {"file": "gsap 3.14.2", "source": "npm gsap", "owner": "third party", "license": "GSAP standard no-charge license"}}}
    (P / "assets/logos").mkdir(parents=True, exist_ok=True); (P / "assets/audio").mkdir(parents=True, exist_ok=True)
    for name in ("whoosh-short", "click-soft", "pop"):
        src = SKILL.parent / "media-use/audio/assets/sfx" / f"{name}.mp3"
        short = {"whoosh-short": "whoosh", "click-soft": "click", "pop": "pop"}[name]
        target = {"whoosh": -28, "click": -26, "pop": -30}[short]
        if src.exists(): ff("-i", src, "-af", f"loudnorm=I={target}:TP=-9", "-ar", "48000", P / f"assets/audio/sfx-{short}.wav")
    for key in dict.fromkeys(t["key"] for t in tools):
        t = LEX[key]
        mark = ensure_mark(key)
        shutil.copy2(ASSET_LIB / mark["file"], P / f"assets/logos/{key}.svg")
        rec = {"name": t["name"], "kind": t["kind"], "mark": {**mark, "file": f"assets/logos/{key}.svg"}}
        if key in footage:
            src, a, b = footage[key]
            dst = P / f"assets/media/rec-{key}{src.suffix.lower()}"
            if not dst.exists(): shutil.copy2(src, dst)
            v = next(s for s in probe(dst)["streams"] if s["codec_type"] == "video")
            a = a if a is not None else min(1.0, duration(dst) / 4)
            b = b if b is not None else duration(dst)
            ff("-ss", f"{max(0, a - 0.5):.2f}", "-t", f"{b - a + 1.0:.2f}", "-i", dst, "-vf",
               f"fps=4,scale=150:-1,drawtext=text='%{{pts\\:hms}}':x=3:y=3:fontsize=12:fontcolor=yellow:box=1:boxcolor=black,tile=10x{max(1, int((b - a + 1) * 4 / 10) + 1)}",
               "-frames:v", "1", P / f"work/broll-{key}.png")
            rec["visual"] = {"kind": "footage", "owner": "speaker (own recording)", "src": str(dst.relative_to(P)),
                             "source": f"speaker's recording {src.name}", "license": "owned by the speaker",
                             "start": a, "end": b, "crop": phone_crop(v["width"], v["height"]), "review": "check work/broll sheet"}
        elif (demo := ensure_demo(key)):
            d = demo.get("reel_defaults", {})
            rec["visual"] = {"kind": "footage", "owner": demo["owner"], "src": "@lib/" + demo["file"],
                             "source": demo["source"], "license": demo["license"], "start": d.get("start", 0),
                             "end": d.get("end"), "rate": d.get("rate", 1.0), "crop": d.get("crop")}
        else:
            rec["visual"] = {"kind": "mark", "file": f"assets/logos/{key}.svg", "owner": mark["owner"], "source": mark["source"], "license": mark["license"]}
        manifest["tools"][key] = rec
        print(f"{t['name']:<14} -> {rec['visual']['kind']:<8} {rec['visual'].get('source')}")
    save(P / "asset-manifest.json", manifest)


if __name__ == "__main__":
    args = sys.argv[2:]
    foot = [args[i + 1] for i, a in enumerate(args) if a == "--footage"]
    main(sys.argv[1], foot)
