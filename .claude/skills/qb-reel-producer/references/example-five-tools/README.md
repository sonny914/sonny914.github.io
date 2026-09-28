# Reference example · "five tools, one job"

This is the first proven QB reel, delivered on 27 September 2026. The finished MP4 is not stored here: personal footage stays out of the repository.

- **Source.** A 66 s, 512×910 talking head plus two of the speaker's screen recordings, of Supabase and Netlify.
- **Result.** A 26 s reel at 1080×1920 and 30 fps. It passed three correction passes, a speaker correction ("AI could build"), and two speaker layout notes: captions lower centre, then moved down.
- **Files:**
  - **The four deliverable documents.** `transcript.txt`, `captions.srt`, `tools-and-edit-map.md` and `ASSETS.md` are the files delivered with the reel. Match this format for every reel.
  - **`edit-map.json`.** The machine-readable edit map.
  - **`reel.json`.** The plan the skill generated from the transcript, plus one speaker correction. `qb_reel.py rebuild` with this plan reproduced the delivered reel's structure, timing and captions. All checks passed, and the visuals landed 0.06–0.08 s before each name.
  - **`model-disagreements.json`.** The six Parakeet/Whisper disagreements and how they were resolved: Parakeet was kept in every case except the speaker-corrected opening.

The hand-built and skill-built versions differ in two small ways:

- **Opening lead-in.** The skill keeps 0.17 s more before the first word, from a breath its detector counted as speech.
- **Recap timing.** The recap starts on the cut rather than on the word.

Both are within the timing rules. Tool count, duration, music, sound effects and font are free to change per reel; the rules in `../brand-and-motion.md` are not.
