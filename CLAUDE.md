# Quiet Bands · project instructions

## Video and Reels: always use `qb-reel-producer`

For every request involving a **Reel, short-form video, talking-head edit, captions, B-roll, tool demonstration, social video, or video export**, automatically load and follow the `qb-reel-producer` skill (`.claude/skills/qb-reel-producer/SKILL.md`) **before beginning any work**.

- **The user does not have to name the skill.** Treat these as automatic triggers:
  - "edit this video"
  - "make this a Reel"
  - "add visuals"
  - "make content from this clip"
  - "caption this"
  - "cut this down"
  - "turn this into a short"
  - any uploaded video with a request to post, polish or export it
- **It takes precedence** over the generic HyperFrames workflows (`/hyperframes`, `/talking-head-recut`, `/embedded-captions`) for Quiet Bands content. It uses HyperFrames internally.
- **Start with the one command** in the skill. Follow its review and correction loop: at least two correction passes before showing a result. Deliver the MP4 with `transcript.txt`, `captions.srt`, `tools-and-edit-map.md` and `ASSETS.md`, in the format of `.claude/skills/qb-reel-producer/references/example-five-tools/`.

## Where things live

- **`video/reels/<slug>/`** holds per-reel projects. It is git-ignored because it contains personal footage.
- **`video/qb-assets/`** holds official product marks and demos, fetched once and reused, with their source and licence in `manifest.json`. Commit additions.
- **`~/.cache/qb-reel/`** holds the speech models and the Python environment. They are reused, never reinstalled.
