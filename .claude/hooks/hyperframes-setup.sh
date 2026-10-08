#!/usr/bin/env bash
# Prepares Claude Code cloud sessions to render HyperFrames video (video/).
# Local machines are left alone: install ffmpeg yourself and let
# `npx hyperframes browser ensure` fetch Chrome.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

# ffmpeg + ffprobe: required to encode and probe media.
if ! command -v ffmpeg >/dev/null 2>&1; then
  (apt-get update -qq && apt-get install -y -qq --no-install-recommends ffmpeg) >/dev/null 2>&1 \
    || echo "hyperframes-setup: ffmpeg install failed; renders will not encode" >&2
fi

# Reuse the preinstalled Playwright headless shell instead of downloading Chrome.
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  shell=$(ls -d /opt/pw-browsers/chromium_headless_shell-*/chrome-linux/headless_shell 2>/dev/null | tail -n1)
  [ -n "$shell" ] && echo "export HYPERFRAMES_BROWSER_PATH=$shell" >> "$CLAUDE_ENV_FILE"
  echo "export HYPERFRAMES_NO_TELEMETRY=1" >> "$CLAUDE_ENV_FILE"
fi
exit 0
