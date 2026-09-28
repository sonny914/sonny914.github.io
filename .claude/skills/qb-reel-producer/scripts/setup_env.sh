#!/usr/bin/env bash
# One-time environment for qb-reel-producer. Safe to re-run: it only installs or downloads what is missing.
#   ffmpeg/ffprobe, Node 22+ (npx hyperframes), Python venv with sherpa-onnx, and two speech models:
#   NVIDIA Parakeet TDT 0.6B v2 (primary, word timings) and Whisper small.en (cross-check),
#   both from the official k2-fsa/sherpa-onnx GitHub releases (huggingface.co and OpenAI's CDN are
#   blocked in Claude Code cloud sessions; GitHub release assets are not).
set -euo pipefail
CACHE="${QB_REEL_CACHE:-$HOME/.cache/qb-reel}"
MODELS="$CACHE/models"
mkdir -p "$MODELS"

if ! command -v ffmpeg >/dev/null || ! command -v ffprobe >/dev/null; then
  echo "installing ffmpeg"; (apt-get update -qq && apt-get install -y -qq --no-install-recommends ffmpeg) >/dev/null
fi
node -e 'process.exit(parseInt(process.versions.node) >= 22 ? 0 : 1)' || { echo "Node 22+ required"; exit 1; }

if ! "$CACHE/venv/bin/python" -c "import sherpa_onnx, soundfile, numpy" 2>/dev/null; then
  echo "creating venv $CACHE/venv"
  python3 -m venv "$CACHE/venv"
  "$CACHE/venv/bin/pip" install -q sherpa-onnx==1.13.8 soundfile numpy
fi

fetch() {  # name
  if [ -f "$MODELS/$1/tokens.txt" ] || ls "$MODELS/$1"/*tokens.txt >/dev/null 2>&1; then echo "model cached: $1"; return; fi
  echo "downloading $1 (one time)"
  curl -fsSL -o "$MODELS/$1.tar.bz2" "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/$1.tar.bz2"
  tar xjf "$MODELS/$1.tar.bz2" -C "$MODELS"
  rm -f -- "${MODELS:?}/${1:?}.tar.bz2"
}
fetch sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8
[ "${QB_SKIP_WHISPER:-0}" = "1" ] || fetch sherpa-onnx-whisper-small.en
echo "qb-reel env ready: $CACHE"
