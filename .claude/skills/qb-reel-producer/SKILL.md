---
name: qb-reel-producer
description: Quiet Bands Reel producer. Load automatically, before starting work, for every request involving a Reel, short-form video, talking-head edit, captions, B-roll, tool demonstration, social video, or video export, even when the skill is not named. Triggers include "edit this video", "make this a Reel", "add visuals", "make content from this clip", "cut this down", "caption this", "turn this into a short", or an uploaded .mov/.mp4 with a request to post it. It turns a talking-head clip into a 1080x1920 QB Reel. The pipeline covers local transcription (sherpa-onnx with Parakeet and Whisper, no paid API), tool detection, an edit map, official or own-footage B-roll, QB-styled captions, a HyperFrames render, verification, and deliverables. It takes precedence over the generic HyperFrames video workflows for Quiet Bands work and uses HyperFrames internally.
---

# qb-reel-producer

This skill turns a talking-head recording into a finished Quiet Bands Reel. It is built from the workflow that produced the first proven reel. The reference example is `references/example-five-tools/`; match its deliverables. The rules are in `references/brand-and-motion.md`. Environment, limitations and every past correction are in `references/workflow-and-lessons.md`. Read both before the first render of a session.

## Start: one command

```bash
python3 .claude/skills/qb-reel-producer/scripts/qb_reel.py new "<video>" --name <slug> \
  [--footage "<Tool>=<own screen recording>@<start>-<end>" ...]
```

- **Setup runs by itself.** If the models are missing, `setup_env.sh` runs first. It is a one-time download from the official sherpa-onnx GitHub releases; afterwards the cached models are reused, never reinstalled.
- **Where it runs.** The project is created in `video/reels/<slug>/`, which is git-ignored. The command ends with `renders/pass1.mp4` and `verify/report.md`.
- **Files over 30 MB.** Chat attachments are capped at 30 MB, and this cloud session can't see the speaker's computer. Have the speaker upload the original to a release on the private repo `sonny914/qb-raw` from Safari (`github.com/sonny914/qb-raw/releases/new`). Then attach that repo with `add_repo`, read the asset's name and size through `gh api repos/sonny914/qb-raw/releases`, and download it at full size. The built-in `gh` refuses GitHub's file-host redirect, so a private asset needs the repo made public for the download, or a git-based handoff. The first proven run, a 154.7 MB file on 8 Oct 2026, went through briefly public; the repo went straight back to private afterwards.
- **Recordings mapped with `--footage`** are the first choice of visual for that tool. If you don't know the clean window yet, omit `@start-end`, look at `work/broll-<tool>.png`, then set `start`, `end` and `crop` in `reel.json`.

## What the steps do

1. **`prepare_video.py`** inspects the source with ffprobe.
   - It keeps a read-only copy of the original and checks its sha256.
   - It writes a proxy only when the source is over 1080×1920, over 30 fps or not H.264, and never upscales.
   - It writes a 16 kHz audio file, a silence map, a contact sheet and a gridded frame for placing captions.
2. **`transcribe.py`** runs Parakeet for words and timings and Whisper small.en as a cross-check.
   - Phrase boundaries come from speech runs in the energy envelope: `on` is the cut point, `hit` is the sync point.
   - Product names are fixed with `references/tool-lexicon.json`.
   - It writes TXT, SRT, VTT, JSON, TSV, `tools.json`, `tools.md` and `disagreements.json`.
3. **`asset_inventory.py`** picks a visual per tool in priority order: the speaker's recording, then an official moving demo, then the official mark.
   - Official assets are fetched once into `video/qb-assets/`, committed with source and licence in `manifest.json`, and reused by every later reel.
   - It never invents an interface. A tool with no real visual is reported as missing.
4. **`plan_edit.py`** drafts `reel.json`: segments with the dead time cut, cues, tool windows, a treatment rotation, a recap and punch-ins.
5. **The build steps:**
   - `cut_aroll.py` cuts the talking head, which is never upscaled here.
   - `make_inserts.py` builds the B-roll clips at exactly 1080×1920.
   - `make_music.py` synthesizes an original bed.
   - `build_composition.py` writes the HyperFrames `index.html`.
   - `hyperframes check`, then `hyperframes render`. The talking head is upscaled once, here.
6. **`verify_render.py`** checks the export:
   - specs, loudness and peak
   - an ASR round trip on the render compared with the captions
   - that visuals land 0–0.15 s before each name and never outlast their subject
   - caption length and treatment variety
   It also writes `sweep.png`, `boundaries.png` and `phone.png`.
7. **`deliver.py`** writes the deliverables: the MP4, `transcript.txt`, `captions.srt` and `.vtt`, `transcript.json`, `tools-and-edit-map.md`, `edit-map.json`, `ASSETS.md`, and a project zip under 30 MB.

## Story B-roll and per-reel framing

These are set in `reel.json`, then applied with `qb_reel.py replan <project>` followed by `rebuild`.

- **`broll`** holds the speaker's own clips tied to a spoken line, such as "use this clip when I say the legs look laid off". Each entry has:
  - `key`, `name`
  - `match`: the spoken words; the visual starts on the first one
  - `src`: the clip copied into `assets/media/`
  - `start` and `end`: the clean window
  - either `crop`, or a full ffmpeg `filter` that outputs 1080×1920
  - `source`, `owner`, `license`, and `treatment` (default `full`)

  Story B-roll gets no tool label, stays out of the recap, and is credited in `ASSETS.md`. For landscape clips, a following square crop padded onto ink keeps the subject large, as in the "prompt was not the product" reel.
- **`framing.punch`** sets the punch-in pairs, such as `[[1.0,1.03],[1.08,1.10]]`. Keep them at 1.10 or below for handheld or low-mouth framing, so the face never reaches the captions.
- **`framing.pivot_y`** sets the cap line the punch-ins pivot on.

## Your job between commands

The scripts draft. You decide.

1. **Review the transcript.** Check `transcript/disagreements.json` and `tools.md`. Ask the speaker about any word you can't settle from context, and always check the opening, because "Hey, I" may be "AI". Put speaker corrections in `reel.json` `corrections`. Add new misspellings of a tool to `tool-lexicon.json`.
2. **Inspect every B-roll sheet.** Exclude notifications, private URLs or keys, Control Center, status and browser bars, other products' names, and the recorder UI. Adjust `start`, `end` and `crop`.
3. **Check the face position.** Use `work/grid.png`. Captions stay at `caption_top` 1330 unless they would cover the mouth at the tightest punch-in. Punch-ins pivot at `pivot_y` on the cap line.
4. **Look at every verification image.** Watch for face flashes between visuals, empty caption plates, captions over the mouth, awkward crops, repeated visuals, and weak pacing or dead air. Then edit `reel.json` and run `qb_reel.py rebuild <project>`.
5. **Do at least two correction passes** before showing anything. Never show a first pass.
6. **Deliver** with `qb_reel.py deliver <project>` and send the MP4 with the four reference documents.
   - Say plainly that you verified audio by loudness and ASR, not by listening.
   - Name anything that used a still mark instead of footage.

## Non-negotiables

- **No paid transcription API.** No unvetted model packages: use only the official sherpa-onnx releases.
- **No fabricated interfaces.** No generic AI imagery. Real footage or official marks only.
- **Every external asset is recorded** with its source, owner and licence. `deliver.py` does this from `asset-manifest.json`; add anything you bring in by hand.
- **The QB palette only:** ink, cream, orange. Orange is for emphasis. No glitch, rainbow, particles, HUD or templates.
- **Keep the speaker's strongest delivery,** their own opening and their own conclusion. Remove dead time aggressively; never write new claims.
- **Tool count, duration, music, sound effects and font are flexible** per reel. The rules are not.
