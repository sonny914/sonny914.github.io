# tools/

## transcribe.py · local captions with faster-whisper

Turns a video or audio file into a timestamped `.srt` caption file and a clean `.txt` transcript. It runs [faster-whisper](https://github.com/SYSTRAN/faster-whisper) on your own machine. No transcription API is called and nothing is paid for.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r tools/requirements-transcribe.txt

python tools/transcribe.py path/to/video.mp4
```

It writes `video.srt` and `video.txt` next to the input. Useful options:

```bash
--model medium          # tiny, base, small (default), medium, large-v3, turbo
--language en           # skip auto-detection
--prompt "Quiet Bands, HyperFrames, Flighty"   # spelling hints for names
--out-dir captions/     # write somewhere else
--keep-fillers          # keep um/uh (dropped by default)
--model-path DIR        # use a model folder you already have; no download
```

**Captions** are cut from word-level timings: at most two lines of 42 characters, at most 7 seconds per cue, and a new cue at every pause or finished sentence. **The transcript** drops fillers and starts a new paragraph wherever the speaker pauses for 2 seconds or more.

The first run downloads the model from huggingface.co into `models/` (git-ignored). `small` is about 500 MB and a good default on a laptop CPU. `large-v3` is more accurate and much slower without a GPU. After that first run, `--offline` guarantees nothing touches the network.

Tests need no model: `python tools/test_transcribe.py`.
