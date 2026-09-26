# QB SITE — BULB ENTRY (docs/BRIEF.md)
Supersedes Spatial Hero. Keep its code in /lab; don't delete.

## Concept
2 surfaces only: entry sequence → R&D page. Nothing else navigable.
Object: fine wireframe lightbulb w/ fractured shell (FLIGHTY AI //
R&D KIT ref: lat/long wireframe, crack lines, thin dimension marks).
Metaphor: kill ideas sooner. Broken bulb = site map.

## Sequence (scroll 0→1, fully reversible)
1 whole bulb on deep black; text = "Quiet Bands" + 1 short line
2 rotate on vertical axis
3 shell separates along cracks; debris particles release
4 4 fragments settle in 3D = nav: Experiments, Build Log, Work, Contact

## Fragments (Igloo behavior, NOT Igloo rendering)
Real edge thickness, varied Z (no flat grid/ring), slow drift,
tilt/pointer parallax, weighted motion. Wireframe cream/bone lines.
No ice/glass/refraction/bloom. Small legible label beside each.
Hover/focus: eases forward, lines → safety orange. Select: camera
moves to fragment → section. Reuse existing engine's tilt/touch/
easing; do not rewrite.

## Particles (holographic)
Debris from the fracture only; none before the crack, no starfield.
1–2px, low alpha, sparse. Foil iridescence: hue shift by view angle,
driven by SAME tilt/pointer input as parallax. Rest/head-on =
near-invisible cream-grey. Only multi-color element on site. If rest
frame reads "sparkly", cut count/alpha. GPU points, capped, fewer on
mobile.

## Visual rules
Near-black ground, cream/bone lines, orange = interactive only.
Take bulb linework + fracture from ref; NOT poster layout, headlines,
checklists, header bars, grid bg. Banned: glow, neon, bloom,
glassmorphism, HUD chrome, cyberpunk, sci-fi decoration. Whole-bulb
and settled frames must look finished with motion off.

## R&D page
Same dark linework language; sections = fragments. Lab 001 = Spatial
Hero told honestly (thesis, diagonal problem, stratum test, failed
geometry test, why motion worked, why retired). One quiet contact
line. Investigative Skeptic Voice. No invented data/metrics/results.

## Stack
three.js via CDN, no framework, Netlify. Fracture pre-baked: Blender
headless (bpy) → Cell Fracture → one compressed .glb (fallback:
split geometry in code). EdgesGeometry for lines. One THREE.Points +
shader for particles. Engine scroll → single progress value.

## Fallbacks
reduced-motion: static settled fragments, tappable; particles static,
no hue shift. No-JS: plain links to 4 sections.

## Tools (one job each)
Emil: motion only. frontend-design: composition review at plan + each
gate. Impeccable: read-only critique at gates 2–3, polish once at end;
hooks OFF, no live/generate/additive modes.

## Gates — STOP at each
1 Plan ≤5 bullets: fracture method, rendering, scroll map, reused
  engine parts, fallbacks
2 Whole bulb + rotation → iPhone + desktop screenshots, rest +
  mid-rotation
3 Separation + settle + parallax + particles → screenshots (separation
  start, settled, rest frame proving particles quiet) + phone
  recording of tilt hue shift
4 Selection transitions + R&D page w/ Lab 001

## Acceptance
Real iPhone evidence every gate; passing tests ≠ visual acceptance.
No bulb/fragment/text collisions anywhere. Tap targets ≥44px,
keyboard focusable, visible focus. Smooth on mid-range phone full
range. Link preview gate: OG/Twitter, absolute URLs, 1200x630 bulb
og:image, favicon, verified live.

## Out of scope
Pricing, offer pages, upmarket pivot, new products.
