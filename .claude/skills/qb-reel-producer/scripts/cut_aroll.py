#!/usr/bin/env python3
"""Cut the talking head per reel.json -> assets/media/aroll.mp4 (native size, never scaled here)
and assets/audio/voice.wav (low-cut, light denoise and compression, two-pass loudnorm)."""
import json, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ff
import timeline_lib


def main(project):
    P = Path(project)
    plan, tl = timeline_lib.build(P)
    segs = tl["segments"]; src = P / plan["source"]
    parts, v, a = [], [], []
    for i, s in enumerate(segs):
        d = s["out"] - s["in"]
        parts.append(f'[0:v]trim=start={s["in"]}:end={s["out"]},setpts=PTS-STARTPTS[v{i}];')
        parts.append(f'[0:a]atrim=start={s["in"]}:end={s["out"]},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st={d-0.01:.4f}:d=0.01[a{i}];')
        v.append(f"[v{i}]"); a.append(f"[a{i}]")
    fc = "".join(parts) + "".join(v) + f"concat=n={len(segs)}:v=1:a=0,fps=30[vo];" + "".join(a) + f"concat=n={len(segs)}:v=0:a=1[ao]"
    (P / "assets/audio").mkdir(parents=True, exist_ok=True); (P / "build").mkdir(exist_ok=True)
    ff("-i", src, "-filter_complex", fc, "-map", "[vo]", "-an", "-c:v", "libx264", "-crf", "10", "-preset", "slow", "-g", "30", "-keyint_min", "30",
       "-pix_fmt", "yuv420p", P / "assets/media/aroll.mp4", "-map", "[ao]", "-ar", "48000", "-ac", "1", P / "build/voice_raw.wav")
    lufs = plan.get("audio", {}).get("voice_lufs", -15)
    chain = "highpass=f=75,afftdn=nr=8:nf=-60,acompressor=threshold=-24dB:ratio=2.5:attack=8:release=160:makeup=2"
    m = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(P / "build/voice_raw.wav"), "-af",
                        f"{chain},loudnorm=I={lufs}:TP=-1.5:LRA=9:print_format=json", "-f", "null", "-"], capture_output=True, text=True).stderr
    j = json.loads(m[m.rindex("{"):m.rindex("}") + 1])
    ln = (f"loudnorm=I={lufs}:TP=-1.5:LRA=9:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:"
          f"measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true")
    ff("-i", P / "build/voice_raw.wav", "-af", f"{chain},{ln}", "-ar", "48000", "-ac", "2", P / "assets/audio/voice.wav")
    print(f"a-roll {tl['duration']:.2f}s from {len(segs)} segments; voice {j['input_i']} -> {lufs} LUFS")


if __name__ == "__main__":
    main(sys.argv[1])
