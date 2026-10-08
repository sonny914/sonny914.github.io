# Workflow, environment and lessons

This is what actually worked on the first proven reel ("five tools, one job", 27 September 2026), and every correction that was needed to get there.

## Environment that works (Claude Code cloud container)

| Need | Working choice | Notes |
|---|---|---|
| Speech recognition | sherpa-onnx 1.13.8 (PyPI) in `~/.cache/qb-reel/venv` | `scripts/setup_env.sh` installs it once |
| Primary model | NVIDIA Parakeet TDT 0.6B v2 int8, `~/.cache/qb-reel/models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8` | Word timings, 80 ms resolution. It heard the product names best. |
| Cross-check model | Whisper small.en, `~/.cache/qb-reel/models/sherpa-onnx-whisper-small.en` | Chunked at pauses, 30 s maximum. Disagreements only flag words for review. |
| Model source | `github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/…` | Downloaded once, then reused from the cache |
| Video | ffmpeg / ffprobe | apt-installed if missing |
| Composition + render | HyperFrames 0.8.80 via `npx`; Chrome = `/opt/pw-browsers/chromium_headless_shell-*/…/headless_shell` | `common.render_env()` sets `HYPERFRAMES_BROWSER_PATH` |
| Animation runtime | GSAP 3.14.2, vendored in `assets/` | The jsdelivr CDN is blocked |
| Official marks | npm `simple-icons` (CC0), `@lobehub/icons-static-svg` (MIT; needed for OpenAI) | Fetched once into the library |
| Official demos | Public product repos over git, such as `anthropics/claude-code` `demo.gif` | Fetched once into the library |

### Blocked in the cloud environment

Do not retry these. Ask the user to allow the host instead.

- **huggingface.co.** faster-whisper, Moonshine and HyperFrames transcribe all download from here or a similar host.
- **openaipublic.azureedge.net.** The official openai-whisper package failed with `URLError: Tunnel connection failed: 403 Forbidden`.
- **download.moonshine.ai.**
- **Product sites and CDNs:** openai.com, chatgpt.com, gemini.google.com, supabase.com, netlify.com, Google static, Wikimedia and YouTube. anthropic.com and claude.com load, but their image CDNs do not.
- **GitHub search APIs.** The session is bound to its repos, but anonymous git clones of public repos and release downloads work.

### Refused on purpose

- **Unvetted model packages.** An npm package re-hosting Whisper ONNX weights was blocked as untrusted. Use only official project releases.
- **Paid transcription APIs.**

### Paths

- Skill: `.claude/skills/qb-reel-producer/`
- Shared official asset library, committed: `video/qb-assets/` with `manifest.json`
- Reel projects, git-ignored and holding personal media: `video/reels/<slug>/`
- Cache: `~/.cache/qb-reel/` holds `models/`, `venv/`, `npm/` and `git/`. Override it with `QB_REEL_CACHE`.
  - On a laptop the cache persists.
  - A fresh cloud container re-downloads the models once, about 1.1 GB.
  - Set `QB_SKIP_WHISPER=1` to skip the cross-check model.

## One command

```bash
python3 .claude/skills/qb-reel-producer/scripts/qb_reel.py new <video> --name <slug> \
  --footage "Supabase=<recording.mp4>@5.0-7.9" --footage "Netlify=<recording.mp4>@7.4-9.2"
```

It prepares, transcribes, inventories assets, drafts `reel.json`, cuts, builds inserts, makes music, builds `index.html`, runs `hyperframes check`, renders `renders/pass1.mp4`, and verifies. In the test run it took about 5 minutes for a 66 s source.

Then loop:

1. Look at `verify/sweep.png`, `verify/boundaries.png`, `verify/phone.png`, `work/broll-*.png`, `work/grid.png`, and review `transcript/disagreements.json`.
2. Edit `reel.json`. That covers corrections, emphasis, footage start/end/crop, treatments, cue text, segment in/out and framing moves.
3. Run `qb_reel.py rebuild <project>`, which re-cuts, renders `passN` and verifies. Use `replan` instead to redraft from the transcript while keeping your corrections and preferences.
4. Once there are at least two correction passes and the images look right, run `qb_reel.py deliver <project>`.

## Corrections made on the reference reel

Each is now a rule.

1. **"Hey, I could build" was really "AI could build."** Both models heard "Hey, I". The speaker corrected it. Put speaker corrections in `reel.json` `corrections`; they apply to captions, the transcript and the words, and verification treats them as matches. Suspect "Hey, I" at the start of any QB reel.
2. **Cutting "Hey," left the "I" inaudible to both models in the export.** Cutting a filler right before a short, unstressed word can swallow it. Keep the pair, or check with the ASR round trip.
3. **Onsets measured with a fixed window scan caught noise frames.** "Gemini" was placed 0.36 s early, "Claude" 0.14 s early. That put visuals and captions before the word and left a dead pause. Speech-run detection fixes it: runs of at least 50 ms, dips under 60 ms bridged, each run assigned to the phrase with the nearest word start. `transcribe.py` records `on` for cutting and `hit` for syncing.
4. **Parakeet word ends include the trailing silence.** Never use them as phrase ends; use the speech runs.
5. **A one-frame face flash appeared between back-to-back visuals.** The outgoing visual ended as the incoming wipe began at 0 %. Hold the outgoing visual under the wipe for 0.22 s, and anchor all visual and caption changes to the cut point.
6. **The picture-in-picture popped in before its wipe covered the frame.** Delay it 0.12 s.
7. **Empty caption plates appeared on cut frames.** The first line started at opacity 0. Start it at 0.45.
8. **Two-line cues were pre-sized to the full cue.** "ChatGPT," sat in a half-empty plate. Hide line 2 with `display: none` until it's voiced.
9. **Captions moved from the top band to lower centre at y 1330 at the speaker's request.** Over the beard is fine.
10. **B-roll traps in the speaker's recordings:**
    - a Control Center opening, 1–4 s
    - the Supabase project URL in the first seconds
    - "OpenAI Codex" text in the Netlify dashboard, until 7.4 s
    - an iOS Low Battery alert at 9.3 s
    - a Safari "Ask Gemini" toolbar state
    Always read the inspection sheet.
11. **The Claude Code demo sits on a multicoloured wallpaper.** Crop to the terminal window, and hold the frame steady; a horizontal pan cut the header in half.
12. **HyperFrames warned about sparse keyframes on intermediate clips.** Encode every clip with `-g 30 -keyint_min 30`.
13. **Sound effect slots longer than the file trigger lint warnings.** Size each slot to the file.
14. **A relative project path made HyperFrames write the render inside a nested folder.** Resolve paths to absolute.
15. **Chat uploads are capped at 30 MB.** Deliver a lean project zip without the raw source and recordings. The composition still renders from its prepared clips.
16. **Claude cannot hear audio.** The audio check is loudness plus peak plus the ASR round trip on the render: Parakeet re-transcribes it and the captions must match at 97 % or better. Say this honestly in the delivery message.

## HyperFrames specifics that matter here

- Timed `<video>` elements go inside untimed wrappers, and all motion goes on the wrapper. Videos are `muted playsinline`. Audio is a separate `<audio id>`.
- The picture-in-picture is a second `<video>` of `aroll.mp4` with `data-media-start` equal to its `data-start`, marked `data-layout-allow-overflow`.
- Never tween `visibility` on a `.clip`. Animate opacity on wrappers or children.
- `hyperframes check` must show 0 errors. The "nested structure" warnings are Studio suggestions and are acceptable.

## Added on the second reel ("the prompt was not the product", 8 October 2026)

17. **The source was over the chat limit: 154.7 MB, 1080×1920.** It arrived through a release on the private `qb-raw` repo and was ingested at full size; ingest took 15 s and transcription 3.5 min. The speaker's own Mac was too old for Claude Code, and the session can't reach a Windows PC's drive either.
18. **The speaker's own clip had to follow a spoken line, not a tool name.** That is now `broll` in `reel.json`, anchored to a word inside the segment.
19. **Long sentences need several two-line captions.** The planner now splits them at the most balanced natural break, timed from word starts (`src_at`). Phrase words are taken in order from `words.json`; slicing by time dropped and duplicated words.
20. **Noise before a late voiced onset.** A run starting 1.6 s before the word "Then" would have left dead air. Segments now start at the later of the run start and `hit` minus 0.2 s.
21. **Outdoor handheld framing puts the mouth near y 1140.** Punch-ins are capped at 1.10 through `framing.punch`, with `pivot_y` 450.

