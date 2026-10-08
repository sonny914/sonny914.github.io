# video/ · HyperFrames

[HyperFrames](https://github.com/heygen-com/hyperframes) (HeyGen, Apache 2.0) renders HTML, CSS and GSAP timelines into deterministic MP4. This folder is one HyperFrames project; `index.html` is a 6 s smoke test in the site's line language (cream wireframe drawing on near-black, then the wordmark).

## Run it

```bash
cd video
npm run check     # lint, runtime, layout, motion, contrast
npm run dev       # Studio preview in the browser
npm run render    # MP4 into video/renders/ (git-ignored)
```

Needs Node 22+ and ffmpeg. On a local machine, `npx hyperframes doctor` lists what is missing and `npx hyperframes browser ensure` fetches Chrome. In Claude Code cloud sessions, `.claude/hooks/hyperframes-setup.sh` installs ffmpeg and points HyperFrames at the preinstalled headless Chrome.

## Notes

- GSAP is vendored at `assets/vendor/gsap-3.14.2.min.js` instead of the jsdelivr CDN, so a render never depends on the network. GSAP ships under its standard no-charge license.
- The agent skills live in `.claude/skills/` (installed with `npx skills add heygen-com/hyperframes`, pinned in `skills-lock.json`). Start with `/hyperframes`; it routes to the right workflow. Refresh with `npx hyperframes skills update`.
- The CLI is pinned to 0.8.80 in `package.json`.
