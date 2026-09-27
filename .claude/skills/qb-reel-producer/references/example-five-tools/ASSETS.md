# Asset and source list

| Asset | Used for | Source | License / terms |
|---|---|---|---|
| `source.mov` (512×910, 65.8 s) | Talking head, all dialogue | Your upload | Yours |
| `rec-supabase.mp4` 5.0–7.9 s | Supabase B-roll | Your screen recording (ScreenRecording_09-23-2026_00-46-15) | Yours. First 5 s skipped: Control Center and the project URL |
| `rec-netlify.mp4` 7.4–9.2 s | Netlify B-roll | Your screen recording (ScreenRecording_09-23-2026_00-58-52) | Yours. Skips "OpenAI Codex" text before 7.4 s and an iOS Low Battery alert at 9.3 s |
| ScreenRecording_09-23-2026_00-44-15 | Not used | Your upload | 1 s of Control Center only |
| `claude-code-demo.gif` 0.6–6.6 s at 2.5× | Claude Code B-roll | Official `demo.gif`, github.com/anthropics/claude-code @ 7779afb12e36 | Anthropic's public product demo; cropped to the terminal window |
| `chatgpt-openai.svg` | ChatGPT mark | OpenAI mark from @lobehub/icons-static-svg 1.95.1 (npm) | Package MIT; the mark is an OpenAI trademark, shown to identify the product |
| `claude.svg`, `googlegemini.svg`, `supabase.svg`, `netlify.svg` | Recap marks, Gemini split | simple-icons 16.33.0 (npm) | CC0; marks are trademarks of their owners, shown to identify the products |
| Space Grotesk 400/700 | All type | Bundled with the HyperFrames skills | SIL Open Font License |
| `sfx-whoosh.wav`, `sfx-click.wav`, `sfx-pop.wav` | Reveal accents | HyperFrames media-use skill (whoosh-short, click-soft, pop) | Pixabay Content License: commercial use, no attribution required |
| `music.wav` | Music bed | Original, synthesized in `build/make_music.py` | Yours |
| GSAP 3.14.2 | Animation runtime | npm `gsap` | GSAP standard no-charge license |

Transcription ran locally with sherpa-onnx 1.13.8 (PyPI) using NVIDIA Parakeet TDT 0.6B v2 and OpenAI Whisper small.en, both downloaded from the official k2-fsa/sherpa-onnx GitHub releases. No paid API was used.

Not available from this environment, so not used: openai.com, chatgpt.com, gemini.google.com, supabase.com and netlify.com all block this sandbox. ChatGPT and Gemini therefore appear as official marks, not interface footage.
