# Quiet Bands · brand and motion rules for Reels

These are the rules the reference reel (`example-five-tools/`) was built and corrected against. Keep them unless the speaker asks otherwise. Tool count, duration, music, sound effects and font can vary per reel. The system cannot.

## Palette

| Token | Hex | Use |
|---|---|---|
| ink | `#0b0a09` | Grounds, split columns, caption plates at 90 % |
| cream | `#efe6d2` | All type, all product marks, hairline borders at 22–35 % |
| orange | `#ff6a1a` | Emphasis only: tool names, the key number phrase, one or two claim words, the 14 px square on a label, the recap rule |

Only real footage brings other colours in. Crop away decoration that fights the palette, such as the multicoloured wallpaper around the Claude Code demo.

## Type

- **Face.** Space Grotesk 700 for captions and recap names, 400 for labels. It is bundled locally under the Open Font License. Another face is fine per reel if it is local and licensed.
- **Captions.** 52 px, line-height 1.12, tracking −0.012 em. Maximum two lines, balanced with `text-wrap: balance`.
- **Labels.** 38–40 px, sentence case, never all caps.

## Layout zones on the 1080×1920 canvas

- **Captions: lower centre, top edge at y 1330.** They sit across the bottom of the beard and chest. The speaker asked for this position. A two-line caption ends near y 1485, clear of the Reels and TikTok caption and username area below about y 1560.
  - Check `work/grid.png` for each new speaker. Captions may sit over the beard, but never over the mouth at the tightest punch-in.
- **Punch-ins pivot on the cap line (y ≈ 400).** Scaling then never pushes the face into the captions. Range 1.00–1.15, because the source is often low resolution and is upscaled once in the render.
- **Picture-in-picture, small.** Right side, 334×500 at (686, 620).
- **Picture-in-picture, recap.** 472×800 at (548, 300).
- **Full-screen label.** Lower-left, 92 px above the caption top.

## Treatments

Vary them; the draft never repeats one back to back.

1. **Talking head.** Restrained punch-ins, alternating wide, tight, medium. It changes on cuts and drifts slightly within a shot.
2. **Split screen, left or right.** An ink column 470 px wide with the official product mark at 260 px and a label. The speaker slides 235 px aside. Use this when the only real visual is a still mark, so the mark never fills the screen alone.
3. **Full-screen B-roll.** A moving recording with a slow 1.00–1.05 push.
4. **Full-screen B-roll with picture-in-picture.** Same as above, with the speaker in the corner box so they stay the main character.
5. **Recap.** When the speaker names the stack, the marks stack vertically beside a large picture-in-picture, and an orange rule draws down the stack on the payoff line.

## Visual priority and honesty

- Use the speaker's own screen recording first, then an official moving demonstration, then the official product mark.
- Never fabricate an interface, mock a UI, or use unrelated "AI" imagery. If none of the three exists, show no visual and ask for a recording.
- **Inspect every B-roll window before use.** The inspection sheet is `work/broll-<tool>.png`. Exclude:
  - notifications and alerts, such as the Low Battery alert at 9.3 s in the Netlify recording
  - private URLs and keys, such as the Supabase project URL in its first seconds
  - Control Center frames
  - status bars and browser toolbars
  - other products' names, such as "OpenAI Codex" inside the Netlify dashboard
  - the recorder's own UI
- Crop status bars off phone recordings. The default drops the top 5 % and crops to 9:16.

## Timing

- **Visuals switch on the cut, about 50 ms before the name is voiced.** The measured lead in the reference is 0.04–0.08 s. It is never after the name, and never more than 0.2 s before it.
- **A visual ends when its explanation ends.** Usually that's the tool name plus its function line. It never outlasts a change of subject.
- **Back-to-back full-screen visuals overlap by the wipe.** The outgoing visual stays underneath for the 0.22 s wipe, so the face never flashes for a frame.
- **Captions change on the cut.** The first line starts at 45 % opacity so a plate is never empty. The second line of a pair appears when it is voiced.

## Motion

- **Cuts by default.** Reveals are quick masked wipes of 0.20–0.24 s with `power3.out`: split columns from their edge, full-screen footage top down.
- **Picture-in-picture enters 0.12 s after its wipe starts.** It scales from 0.90 to 1 over 0.22 s.
- **Recap rows stagger 0.09 s apart.** The orange rule draws over 0.42 s with `power2.inOut`.
- **Banned:** glitch, rainbow or gradient colour, floating particles, fake HUD graphics, generic tech templates, glow, bounce.

## Sound

- **Voice at −15 LUFS integrated, true peak ≤ −1.5 dBFS.** Chain: high-pass at 75 Hz, light denoise, 2.5:1 compression, two-pass loudnorm.
- **Music about 16 LU under the voice (−31 LUFS).** The default is an original synthesized bed: an E-minor drone, a soft 96 BPM pulse, and a fifth that enters at the recap. A licensed track is fine, but record it in ASSETS.md.
- **Sound effects at −26 to −30 LUFS, one per reveal.** A whoosh for full-screen, a click for a split, a pop for the recap. All are Pixabay-licensed and bundled with the HyperFrames media-use skill.

## Editing the speech

- **Cut every dead pause.** Keep a lead-in of 0.05 s. After each phrase, keep a pause of:
  - 0.14 s after a tool name
  - 0.16 s after a comma
  - 0.26 s after a sentence
  - 0.30 s after a question
  - 0.9 s as the final hold
- **Keep the speaker's own opening and conclusion.** Never write a new claim.
- **Never cut a word so tightly that it becomes inaudible.** The ASR round trip in `verify_render.py` catches this.
