"""Shared paths, environment and helpers for qb-reel-producer. Standard library only."""
from __future__ import annotations
import json, os, shutil, subprocess, sys
from pathlib import Path

SKILL = Path(__file__).resolve().parent.parent
REPO = Path(subprocess.run(["git", "-C", str(SKILL), "rev-parse", "--show-toplevel"],
                           capture_output=True, text=True).stdout.strip() or SKILL.parents[2])
CACHE = Path(os.environ.get("QB_REEL_CACHE", Path.home() / ".cache" / "qb-reel"))
MODELS = CACHE / "models"
VENV_PY = CACHE / "venv" / "bin" / "python"
ASSET_LIB = REPO / "video" / "qb-assets"          # committed, reusable official tool assets
REELS = REPO / "video" / "reels"                  # per-reel projects (git-ignored)
HF_VERSION = "0.8.80"
PARAKEET = MODELS / "sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8"
WHISPER = MODELS / "sherpa-onnx-whisper-small.en"
MODEL_URLS = {
    PARAKEET.name: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8.tar.bz2",
    WHISPER.name: "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-small.en.tar.bz2",
}
FPS = 30
W, H = 1080, 1920


def run(cmd, **kw):
    kw.setdefault("check", True)
    return subprocess.run([str(c) for c in cmd], **kw)


def ff(*args):
    return run(["ffmpeg", "-v", "error", "-y", *args])


def probe(path) -> dict:
    out = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def duration(path) -> float:
    return float(probe(path)["format"]["duration"])


def load(path):
    return json.loads(Path(path).read_text())


def save(path, data):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")


def render_env() -> dict:
    env = dict(os.environ, HYPERFRAMES_NO_TELEMETRY="1")
    if "HYPERFRAMES_BROWSER_PATH" not in env:
        shells = sorted(Path("/opt/pw-browsers").glob("chromium_headless_shell-*/chrome-linux/headless_shell"))
        if shells:
            env["HYPERFRAMES_BROWSER_PATH"] = str(shells[-1])
    return env


def hyperframes(project, *args, **kw):
    return run(["npx", "-y", f"hyperframes@{HF_VERSION}", *args], cwd=project, env=render_env(), **kw)


def need_venv():
    """Re-exec under the cached venv (sherpa-onnx, numpy, soundfile) when the current python lacks them."""
    try:
        import numpy, soundfile, sherpa_onnx  # noqa: F401
    except ImportError:
        if not VENV_PY.exists():
            sys.exit(f"Missing {VENV_PY}. Run: bash {SKILL}/scripts/setup_env.sh")
        if Path(sys.prefix).resolve() != (CACHE / "venv").resolve():
            os.execv(str(VENV_PY), [str(VENV_PY), *sys.argv])
        raise


def ts(t: float, sep=",") -> str:
    ms = max(0, round(t * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def snap(t: float) -> float:
    return round(round(t * FPS) / FPS, 4)


def tool_on_path(name):
    return shutil.which(name) is not None


def apply_text_corrections(text: str, corrections) -> str:
    """reel.json "corrections": [{"from": "Hey, I", "to": "AI"}] - speaker-confirmed fixes."""
    for c in corrections or []:
        text = text.replace(c["from"], c["to"])
    return text


def resolve(project, path) -> Path:
    """Project-relative path, or '@lib/...' for the shared official asset library (video/qb-assets)."""
    return ASSET_LIB / path[5:] if str(path).startswith("@lib/") else Path(project) / path
