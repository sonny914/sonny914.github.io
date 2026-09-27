#!/usr/bin/env python3
"""Original music bed, synthesized locally (no library track, no licence question): E-minor drone,
soft 96 BPM pulse, quiet off-beat ticks, a fifth that enters at the recap, fade out on the last line.
Written at reel.json audio.music.lufs (default -31 LUFS, ~16 LU under the voice).
Set audio.music to {"file": "assets/audio/<track>.wav"} to use a licensed track instead, or null for none."""
import sys, subprocess
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import need_venv
need_venv()
import numpy as np, soundfile as sf
import timeline_lib


def main(project):
    P = Path(project)
    plan, tl = timeline_lib.build(P)
    m = plan.get("audio", {}).get("music", {"kind": "synth", "lufs": -31})
    out = P / "assets/audio/music.wav"
    if not m:
        out.unlink(missing_ok=True); print("no music"); return
    if m.get("file"):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(P / m["file"]), "-t", str(tl["duration"]), "-af",
                        f"afade=t=out:st={tl['duration'] - 1.6}:d=1.6,loudnorm=I={m.get('lufs', -31)}:TP=-9:LRA=11", "-ar", "48000", str(out)], check=True)
        print("music:", m["file"]); return
    DUR, SR = tl["duration"], 48000
    t = np.arange(int(DUR * SR)) / SR; rng = np.random.default_rng(7)
    def tone(f, det=0.0):
        return np.sin(2*np.pi*f*t) + 0.6*np.sin(2*np.pi*f*(1+det)*t + 1.3) + 0.12*np.sin(2*np.pi*2*f*t)
    pad = sum(a*tone(f, 0.003) for f, a in [(82.41, .9), (123.47, .55), (164.81, .45), (196.0, .3)])
    pad *= 0.75 + 0.25*np.sin(2*np.pi*0.11*t)
    lift = 0
    if tl["recap"]:
        lift = np.clip((t - tl["recap"]["in"]) / 0.6, 0, 1) * 0.35 * tone(246.94, 0.002)
    beat = 60/96; pulse = np.zeros_like(t); tick = np.zeros_like(t)
    for k in range(int(DUR/beat)+1):
        s0 = int(k*beat*SR); n = int(0.18*SR)
        if s0 >= len(t): break
        env = np.exp(-np.arange(n)/SR/0.05)[: len(t)-s0]
        pulse[s0:s0+len(env)] += np.sin(2*np.pi*52*np.arange(len(env))/SR) * env
        s1 = int((k+0.5)*beat*SR); mm = int(0.02*SR)
        if s1 + mm < len(t):
            noise = rng.standard_normal(mm) * np.exp(-np.arange(mm)/SR/0.004)
            tick[s1:s1+mm] += np.diff(np.concatenate([[0], noise]))
    mix = 0.5*pad + 0.25*lift + 0.5*pulse + 0.05*tick
    mix *= np.clip(t/1.2, 0, 1) * np.clip((DUR - t)/1.6, 0, 1)
    mix /= np.max(np.abs(mix)) * 1.2
    raw = P / "build/music_raw.wav"
    sf.write(raw, np.stack([mix, mix*0.98], 1).astype(np.float32), SR)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", f"lowpass=f=2400,loudnorm=I={m.get('lufs', -31)}:TP=-9:LRA=11",
                    "-ar", "48000", str(out)], check=True)
    print(f"music: synthesized {DUR:.1f}s bed")


if __name__ == "__main__":
    main(sys.argv[1])
