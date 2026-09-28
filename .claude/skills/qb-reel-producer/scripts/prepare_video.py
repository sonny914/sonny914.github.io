#!/usr/bin/env python3
"""Step 1: inspect the source, preserve the original, make a working proxy only when required.

  prepare_video.py <source video> <project dir>

Writes <project>/assets/media/source.<ext> (read-only copy + sha256), work/probe.json,
work/audio16k.wav, work/silence.json, work/contact.png, work/grid.png (100 px grid at output
scale, for placing captions above the face) and, only if needed, assets/media/proxy.mp4.
The talking head is never upscaled here: the single upscale happens in the render.
"""
import hashlib, re, shutil, stat, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ff, probe, save, W, H, FPS


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(src, project):
    src, project = Path(src), Path(project)
    media, work = project / "assets/media", project / "work"
    media.mkdir(parents=True, exist_ok=True); work.mkdir(parents=True, exist_ok=True)
    keep = media / f"source{src.suffix.lower()}"
    if not keep.exists():
        shutil.copy2(src, keep)
        keep.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)   # the original is never edited
    digest = sha256(keep)
    assert digest == sha256(src), "copy of the original does not match"
    info = probe(keep)
    v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    if a is None:
        sys.exit("source has no audio track: nothing to transcribe")
    rot = abs(int(v.get("tags", {}).get("rotate", 0) or 0)) or next(
        (abs(int(sd.get("rotation", 0))) for sd in v.get("side_data_list", []) if "rotation" in sd), 0)
    w, h = (v["height"], v["width"]) if rot in (90, 270) else (v["width"], v["height"])
    num, den = map(int, v["r_frame_rate"].split("/")); fps = num / den if den else 0
    reasons = []
    if w > W or h > H: reasons.append(f"{w}x{h} exceeds {W}x{H}")
    if fps > FPS + 0.5: reasons.append(f"{fps:.2f} fps > {FPS}")
    if v["codec_name"] not in ("h264",): reasons.append(f"codec {v['codec_name']}")
    working = keep
    if reasons:  # downscale/convert only; never upscale
        working = media / "proxy.mp4"
        ff("-i", keep, "-vf", f"scale='min({W},iw)':-2:flags=lanczos,fps={FPS},format=yuv420p",
           "-c:v", "libx264", "-crf", "12", "-preset", "slow", "-g", "30", "-c:a", "aac", "-b:a", "256k", working)
    ff("-i", keep, "-ac", "1", "-ar", "16000", work / "audio16k.wav")
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(work / "audio16k.wav"), "-af",
                          "silencedetect=noise=-35dB:d=0.4", "-f", "null", "-"], capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    dur = float(info["format"]["duration"])
    ff("-i", working, "-vf", f"fps=12/{dur},scale=180:-1,tile=6x2", "-frames:v", "1", work / "contact.png")
    ff("-ss", f"{min(dur / 2, dur - 0.1):.2f}", "-i", working, "-frames:v", "1", "-vf",
       f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},drawgrid=w={W}:h=100:t=2:c=orange@0.7,"
       f"scale=360:-1", work / "grid.png")
    meta = {"original": str(src), "kept": str(keep.relative_to(project)), "sha256": digest,
            "width": w, "height": h, "fps": round(fps, 3), "duration": dur, "video_codec": v["codec_name"],
            "audio": {"codec": a["codec_name"], "rate": a.get("sample_rate"), "channels": a.get("channels")},
            "working": str(working.relative_to(project)), "proxy_reasons": reasons,
            "upscale_factor_to_1080w": round(W / w, 3)}
    save(work / "probe.json", meta)
    save(work / "silence.json", [{"start": s, "end": e} for s, e in zip(st, en)])
    print(f"source {w}x{h} {fps:.2f}fps {dur:.1f}s  proxy: {'yes (' + '; '.join(reasons) + ')' if reasons else 'not needed'}")
    if w < W:
        print(f"note: source is {w}px wide; the render upscales it once by {W / w:.2f}x. Keep punch-ins <= 1.15.")
    return meta


if __name__ == "__main__":
    main(*sys.argv[1:3])
