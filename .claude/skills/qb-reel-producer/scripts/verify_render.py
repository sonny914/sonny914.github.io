#!/usr/bin/env python3
"""Render verification. Machine checks + images Claude must look at before delivery.

  verify_render.py <project dir> <render.mp4>

Checks: 1080x1920 / 30 fps / h264 + aac; duration; loudness (voice target +-1 LU, true peak <= -1 dBFS);
caption accuracy (Parakeet re-transcribes the render, compared with the burned-in captions; speaker
corrections in reel.json count as matches); visual timing (each tool visual lands 0-0.15 s before the
name is voiced, never after, and is gone when the subject changes); caption length (<= 2 lines).
Images in verify/: sweep.png (every 0.5 s, phone size), boundaries.png (frame-by-frame around every
visual change), phone.png (390 px wide frames at each tool). Claude still has to LOOK at them:
face flashes, empty caption plates, crops, distractions and repeated visuals are judged by eye.
Claude cannot hear audio; loudness + the ASR round trip are the audio check.
"""
import difflib, json, re, subprocess, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import need_venv, PARAKEET, load, save, probe, ff, apply_text_corrections
need_venv()
import soundfile as sf, sherpa_onnx as so
import timeline_lib


def asr(wav):
    rec = so.OfflineRecognizer.from_transducer(encoder=str(PARAKEET / "encoder.int8.onnx"), decoder=str(PARAKEET / "decoder.int8.onnx"),
                                               joiner=str(PARAKEET / "joiner.int8.onnx"), tokens=str(PARAKEET / "tokens.txt"),
                                               model_type="nemo_transducer", num_threads=4)
    a, sr = sf.read(wav, dtype="float32"); s = rec.create_stream(); s.accept_waveform(sr, a); rec.decode_stream(s)
    return s.result.text


def main(project, render):
    P, R = Path(project), Path(render)
    V = P / "verify"; V.mkdir(exist_ok=True)
    plan, tl = timeline_lib.build(P)
    rep, fails, warns = [], [], []
    info = probe(R); v = next(s for s in info["streams"] if s["codec_type"] == "video")
    a = next((s for s in info["streams"] if s["codec_type"] == "audio"), None)
    spec = (v["width"], v["height"], v["r_frame_rate"], v["codec_name"], a and a["codec_name"])
    rep.append(f"spec {spec}, {float(info['format']['duration']):.2f}s (plan {tl['duration']:.2f}s)")
    if spec[:4] != (1080, 1920, "30/1", "h264") or not a: fails.append(f"export spec {spec}")
    if abs(float(info["format"]["duration"]) - tl["duration"]) > 0.15: fails.append("duration differs from plan")
    eb = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(R), "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    I = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", eb)[-1]); pk = float(re.findall(r"Peak:\s+(-?[\d.]+) dBFS", eb)[-1])
    target = plan.get("audio", {}).get("voice_lufs", -15)
    rep.append(f"loudness {I} LUFS (target {target}), true peak {pk} dBFS")
    if abs(I - target) > 1: fails.append(f"loudness {I} LUFS")
    if pk > -1: fails.append(f"true peak {pk} dBFS")
    # caption accuracy
    wav = V / "render16k.wav"
    ff("-f", "lavfi", "-t", "0.6", "-i", "anullsrc=r=16000:cl=mono", "-i", R, "-filter_complex",
       "[1:a]aresample=16000,pan=mono|c0=0.5*c0+0.5*c1[b];[0][b]concat=n=2:v=0:a=1", "-ar", "16000", wav)
    heard = asr(wav)
    caps = " ".join(apply_text_corrections(l["text"], plan.get("corrections")).replace("*", "") for c in plan["cues"] for l in c["lines"])
    def norm(x):
        x = x.lower()
        for c in plan.get("corrections", []):
            x = x.replace(c["from"].lower(), c["to"].lower())
        return re.sub(r"[^a-z0-9' ]", " ", x).split()
    lex = load(Path(__file__).resolve().parent.parent / "references/tool-lexicon.json")["tools"]
    def canon(ws):
        s = " ".join(ws)
        for t in lex.values():
            for al in t["aliases"]:
                s = re.sub(rf"\b{re.escape(al)}\b", t["name"].lower(), s)
        return s.split()
    h, c = canon(norm(heard)), canon(norm(caps))
    sm = difflib.SequenceMatcher(a=c, b=h, autojunk=False); ratio = sm.ratio()
    diffs = [(op, c[i1:i2], h[j1:j2]) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal"]
    rep.append(f"captions vs speech: {ratio:.3f} word match; differences: {diffs or 'none'}")
    if ratio < 0.97: fails.append(f"captions differ from speech ({ratio:.3f})")
    # timing
    segs = tl["segments"]
    for k, w in enumerate(tl["windows"]):
        lead = w["voiced"] - w["in"]
        nxt = tl["windows"][k + 1]["in"] if k + 1 < len(tl["windows"]) else (tl["recap"]["in"] if tl["recap"] else tl["duration"])
        rep.append(f"{w['name']:<12} voiced {w['voiced']:6.2f}  visual {w['in']:6.2f}-{w['out']:6.2f} (hold {w['hold']:.2f})  lead {lead:+.2f}s  {w['treatment']}")
        if lead < -0.02: fails.append(f"{w['name']} visual appears {-lead:.2f}s after the name")
        elif lead > 0.2: fails.append(f"{w['name']} visual appears {lead:.2f}s before the name")
        elif lead > 0.15: warns.append(f"{w['name']} visual lead {lead:.2f}s (target ~0.05)")
        if w["out"] > nxt + 0.01: fails.append(f"{w['name']} visual outlasts its subject")
    for n, cue in enumerate(plan["cues"]):
        ls = [apply_text_corrections(l["text"], plan.get("corrections")).replace("*", "") for l in cue["lines"]]
        if len(ls) > 2 or (len(ls) == 2 and max(map(len, ls)) > 32) or (len(ls) == 1 and len(ls[0]) > 62):
            warns.append(f"cue {n} may exceed two lines: {ls}")
    # treatment variety
    seq = [w["treatment"] for w in tl["windows"]]
    if any(x == y for x, y in zip(seq, seq[1:])): warns.append(f"repeated treatment back to back: {seq}")
    # black frames
    bd = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(R), "-vf", "blackdetect=d=0.05:pix_th=0.05", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    blacks = re.findall(r"black_start:([\d.]+) black_end:([\d.]+)", bd)
    if blacks: warns.append(f"black frames at {blacks}")
    # images
    d = tl["duration"]; times = [round(0.25 + 0.5 * i, 2) for i in range(int(d / 0.5))]
    tmp = V / "frames"; tmp.mkdir(exist_ok=True)
    for f in tmp.glob("*.png"): f.unlink()
    for i, t in enumerate(times):
        ff("-ss", t, "-i", R, "-frames:v", "1", "-vf", f"scale=150:-1,drawtext=text='{t}':x=3:y=3:fontsize=13:fontcolor=yellow:box=1:boxcolor=black", tmp / f"s{i:03d}.png")
    ff("-i", tmp / "s%03d.png", "-vf", "tile=9x" + str(-(-len(times) // 9)), "-frames:v", "1", V / "sweep.png")
    bounds = sorted({x for w in tl["windows"] for x in (w["in"], w["out"], w["hold"])} | ({tl["recap"]["in"], tl["recap"]["out"]} if tl["recap"] else set()))
    j = 0
    for b in bounds:
        fr = round(b * 30)
        for k in (-1, 0, 1, 3, 6):
            ff("-i", R, "-vf", f"select=eq(n\\,{fr + k}),scale=110:-1,drawtext=text='f{fr + k}':x=3:y=3:fontsize=11:fontcolor=yellow:box=1:boxcolor=black",
               "-frames:v", "1", "-vsync", "0", tmp / f"b{j:03d}.png"); j += 1
    ff("-i", tmp / "b%03d.png", "-vf", f"tile=10x{-(-j // 10)}", "-frames:v", "1", V / "boundaries.png")
    for i, w in enumerate(tl["windows"]):
        ff("-ss", round(w["voiced"] + 0.5, 2), "-i", R, "-frames:v", "1", "-vf", "scale=390:-1", tmp / f"p{i:03d}.png")
    if tl["windows"]:
        ff("-i", tmp / "p%03d.png", "-vf", f"tile={min(4, len(tl['windows']))}x{-(-len(tl['windows']) // 4)}", "-frames:v", "1", V / "phone.png")
    status = "FAIL" if fails else "PASS"
    txt = "\n".join([f"# Verification: {status}", f"render: {R}", "", *rep, "", "Failures:", *(fails or ["none"]), "", "Warnings:", *(warns or ["none"]), "",
                     "Look at verify/sweep.png, verify/boundaries.png and verify/phone.png before delivering:",
                     "face flashes between visuals, empty caption plates, captions over the mouth, cropped labels,",
                     "notifications/URLs/Control Center in B-roll, repeated visuals, weak pacing."])
    (V / "report.md").write_text(txt + "\n"); save(V / "report.json", {"status": status, "fails": fails, "warns": warns, "lines": rep, "heard": heard})
    print(txt)
    return not fails


if __name__ == "__main__":
    sys.exit(0 if main(sys.argv[1], sys.argv[2]) else 1)
