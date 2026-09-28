#!/usr/bin/env python3
"""Transcribe a video or audio file locally with faster-whisper.

Writes two files next to the input (or into --out-dir):
  <name>.srt  timestamped captions, cut from word timings into readable cues,
              um/uh dropped
  <name>.txt  clean transcript: fillers removed, paragraphs at long pauses

Everything runs on this machine. No transcription API is called. The only
network use is the one-time model download from Hugging Face, which
--model-path or --offline avoids.

  python tools/transcribe.py talk.mp4
  python tools/transcribe.py talk.mp4 --model medium --language en
  python tools/transcribe.py talk.mp4 --model-path models/faster-whisper-small
"""

from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

# Caption shape. 42 characters per line and 2 lines is the common broadcast
# and streaming limit; 7 s is the usual ceiling for one cue on screen.
MAX_LINE_CHARS = 42
MAX_LINES = 2
MAX_CUE_SECONDS = 7.0
MIN_CUE_SECONDS = 0.8
PAUSE_BREAK_SECONDS = 0.6  # a silence this long closes the current cue
PARAGRAPH_PAUSE_SECONDS = 2.0  # a silence this long starts a new paragraph

FILLERS = re.compile(r"(?i)(?<![\w'])(?:um+|uh+|erm+|hmm+|mm+|ah+)(?![\w'])[,.]?")


@dataclass
class Word:
    start: float
    end: float
    text: str


@dataclass
class Cue:
    start: float
    end: float
    text: str


# ---------------------------------------------------------------- captions


def is_filler(token: str) -> bool:
    return FILLERS.fullmatch(token.strip()) is not None


def drop_fillers(words: list[Word]) -> list[Word]:
    """Remove um/uh words; a word that now opens a sentence gets its capital."""
    kept: list[Word] = []
    capitalize = False
    for i, w in enumerate(words):
        sentence_start = i == 0 or words[i - 1].text.endswith((".", "?", "!"))
        if is_filler(w.text):
            capitalize = capitalize or sentence_start
            continue
        if capitalize and w.text[:1].islower():
            w = Word(w.start, w.end, w.text[:1].upper() + w.text[1:])
        capitalize = False
        kept.append(w)
    return kept


def wrap_lines(text: str, width: int = MAX_LINE_CHARS) -> list[str]:
    """Greedy word wrap that never splits a word."""
    lines: list[str] = []
    line = ""
    for token in text.split():
        candidate = f"{line} {token}".strip()
        if line and len(candidate) > width:
            lines.append(line)
            line = token
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def balance_two_lines(text: str, width: int = MAX_LINE_CHARS) -> str:
    """Split a cue into at most two lines of similar length."""
    if len(text) <= width:
        return text
    tokens = text.split()
    best = None
    for i in range(1, len(tokens)):
        a, b = " ".join(tokens[:i]), " ".join(tokens[i:])
        if len(a) <= width and len(b) <= width:
            score = abs(len(a) - len(b))
            if best is None or score < best[0]:
                best = (score, a, b)
    if best:
        return f"{best[1]}\n{best[2]}"
    return "\n".join(wrap_lines(text, width))


def words_to_cues(words: list[Word]) -> list[Cue]:
    """Group timed words into caption cues.

    A cue closes when adding the next word would exceed two lines or the
    maximum duration, or when the speaker pauses. A cue that has reached a
    sentence end also closes, so captions follow the speech rhythm.
    """
    cues: list[Cue] = []
    current: list[Word] = []
    max_chars = MAX_LINE_CHARS * MAX_LINES

    def flush() -> None:
        if current:
            text = " ".join(w.text for w in current).strip()
            cues.append(Cue(current[0].start, current[-1].end, text))
            current.clear()

    for word in words:
        if current:
            text = " ".join(w.text for w in current + [word])
            too_long = len(text) > max_chars
            too_slow = word.end - current[0].start > MAX_CUE_SECONDS
            paused = word.start - current[-1].end >= PAUSE_BREAK_SECONDS
            sentence_done = current[-1].text.endswith((".", "?", "!")) and (
                current[-1].end - current[0].start >= MIN_CUE_SECONDS
            )
            if too_long or too_slow or paused or sentence_done:
                flush()
        current.append(word)
    flush()

    # Keep short cues readable without overlapping the next one.
    for i, cue in enumerate(cues):
        if cue.end - cue.start < MIN_CUE_SECONDS:
            limit = cues[i + 1].start if i + 1 < len(cues) else cue.start + MIN_CUE_SECONDS
            cue.end = max(cue.end, min(cue.start + MIN_CUE_SECONDS, limit))
    return cues


def srt_timestamp(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def to_srt(cues: list[Cue]) -> str:
    blocks = []
    for i, cue in enumerate(cues, 1):
        blocks.append(
            f"{i}\n{srt_timestamp(cue.start)} --> {srt_timestamp(cue.end)}\n"
            f"{balance_two_lines(cue.text)}\n"
        )
    return "\n".join(blocks)


# -------------------------------------------------------------- transcript


def clean_text(text: str) -> str:
    """Remove filler words and repair the spacing and capitals they leave."""
    text = FILLERS.sub("", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([,.?!;:])", r"\1", text)
    text = re.sub(r"^[,.;:\s]+", "", text)
    text = re.sub(r"([.?!])[,;:]+", r"\1", text)
    text = re.sub(r",{2,}", ",", text)
    text = re.sub(r"(^|[.?!]\s+)([a-z])", lambda m: m.group(1) + m.group(2).upper(), text)
    return text.strip()


def to_paragraphs(segments: list[tuple[float, float, str]], keep_fillers: bool = False) -> str:
    """Join segments into paragraphs, breaking where the speaker pauses."""
    paragraphs: list[list[str]] = [[]]
    last_end = None
    for start, end, text in segments:
        if last_end is not None and start - last_end >= PARAGRAPH_PAUSE_SECONDS and paragraphs[-1]:
            paragraphs.append([])
        paragraphs[-1].append(text.strip())
        last_end = end
    out = []
    for para in paragraphs:
        joined = " ".join(para)
        joined = joined if keep_fillers else clean_text(joined)
        if joined:
            out.append(joined)
    return "\n\n".join(out) + "\n"


# ------------------------------------------------------------------- run


def has_audio(path: Path) -> bool:
    import av  # installed with faster-whisper

    try:
        with av.open(str(path)) as container:
            return len(container.streams.audio) > 0
    except av.error.FFmpegError:
        return False


def load_model(args: argparse.Namespace):
    from faster_whisper import WhisperModel

    source = args.model_path or args.model
    try:
        return WhisperModel(
            source,
            device=args.device,
            compute_type=args.compute_type,
            download_root=args.download_root,
            local_files_only=args.offline,
        )
    except Exception as exc:  # network, missing files, bad path
        sys.exit(
            f"Could not load the Whisper model '{source}': {exc}\n\n"
            "The first run downloads the model from huggingface.co. If this machine\n"
            "cannot reach it, copy a converted CTranslate2 model folder here and pass\n"
            "--model-path <folder> (it holds model.bin, config.json, tokenizer.json\n"
            "and vocabulary.*)."
        )


def transcribe(args: argparse.Namespace) -> None:
    src = Path(args.input)
    if not src.is_file():
        sys.exit(f"No such file: {src}")
    if not has_audio(src):
        sys.exit(f"{src} has no audio track (or is not a media file). Nothing to transcribe.")
    out_dir = Path(args.out_dir) if args.out_dir else src.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = out_dir / src.stem

    print(f"Loading model {args.model_path or args.model} ...", file=sys.stderr)
    model = load_model(args)

    t0 = time.time()
    segments_iter, info = model.transcribe(
        str(src),
        language=args.language,
        beam_size=args.beam_size,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        condition_on_previous_text=False,  # stops one bad segment from repeating
        initial_prompt=args.prompt,
    )
    print(
        f"Language: {info.language} (p={info.language_probability:.2f}), "
        f"audio {info.duration:.1f}s",
        file=sys.stderr,
    )

    words: list[Word] = []
    segments: list[tuple[float, float, str]] = []
    for seg in segments_iter:
        segments.append((seg.start, seg.end, seg.text))
        for w in seg.words or []:
            token = w.word.strip()
            if token:
                words.append(Word(w.start, w.end, token))
        print(f"  [{srt_timestamp(seg.start)}] {seg.text.strip()}", file=sys.stderr)

    if not segments:
        sys.exit("No speech found. Check that the file has an audio track.")

    srt_path = stem.with_suffix(".srt")
    txt_path = stem.with_suffix(".txt")
    if not args.keep_fillers:
        words = drop_fillers(words)
    srt_path.write_text(to_srt(words_to_cues(words)), encoding="utf-8")
    txt_path.write_text(to_paragraphs(segments, args.keep_fillers), encoding="utf-8")

    elapsed = time.time() - t0
    print(f"\nWrote {srt_path}\nWrote {txt_path}", file=sys.stderr)
    print(f"Transcribed {info.duration:.1f}s of audio in {elapsed:.1f}s", file=sys.stderr)


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("input", help="video or audio file (mp4, mov, m4a, mp3, wav, ...)")
    p.add_argument("--model", default="small", help="tiny, base, small, medium, large-v3, turbo (default: small)")
    p.add_argument("--model-path", help="local CTranslate2 model folder; skips any download")
    p.add_argument("--language", help="language code such as en; auto-detected when omitted")
    p.add_argument("--out-dir", help="where to write the .srt and .txt (default: next to the input)")
    p.add_argument("--prompt", help="spelling hints, e.g. names and jargon: 'Quiet Bands, HyperFrames'")
    p.add_argument("--beam-size", type=int, default=5)
    p.add_argument("--device", default="auto", help="auto, cpu or cuda")
    p.add_argument("--compute-type", default="auto", help="auto, int8, float16, ... (auto picks int8 on CPU)")
    p.add_argument("--download-root", default=str(Path(__file__).resolve().parent.parent / "models"),
                   help="model cache folder (default: models/ at the repo root, git-ignored)")
    p.add_argument("--offline", action="store_true", help="never touch the network; use cached models only")
    p.add_argument("--keep-fillers", action="store_true", help="keep um/uh in both the captions and the transcript")
    transcribe(p.parse_args(argv))


if __name__ == "__main__":
    main()
