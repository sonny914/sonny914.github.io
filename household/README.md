# The Cottage (slice 1)

Private, phone-first coordination for one home: three adults (Jay, Fallon, Adult 3) and two children (Khodi, Kenzli).
Slice 1 is the app shell and the Home day board. **Mock data only**: no auth, database, integrations, OCR, calendar sync or notifications.

## Run

```bash
cd household
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for a phone)
npm run validate   # typecheck + oxlint + tests + production build
```

Also: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Structure

- `src/data/types.ts` domain model (members, events, confirmation, coverage requests, reminders, uploaded schedules)
- `src/data/members.ts` the five profiles. **Rename Adult 3 via `ADULT_3_NAME`.** Avatar initials are explicit (Kenzli is "D", for Ducki)
- `src/data/seed.ts` sample household, generated relative to today
- `src/data/demoState.ts` pure overlay of what people changed in the demo (cover, confirm, done, mail, and their undos)
- `src/data/repository.ts` the only seam to storage; persists the overlay. Swap for a database here
- `src/lib/` date helpers and pure selectors (today, upcoming, needs-attention, next up, mail)
- `src/components/`, `src/screens/` small UI pieces. Home is functional; Calendar, Coverage and Household are placeholders

## Demo behaviour

- **Viewing as** (top right) stands in for sign-in and attributes actions.
- "I'll cover", "Confirm", "Done" and the mail check persist in localStorage (`cottage.demo.v1`). Each has a ten-second Undo; the mail strip keeps its own Undo.
- The Add sheet is a preview only; nothing is saved.

## Design notes

A day board, not a dashboard. Warm white dominates; navy is text, structure and navigation; cornflower marks what is selected or interactive (tab underline, nav indicator, the current and next row, focus); coral marks unresolved responsibilities as a narrow edge, icon or dot, never as text. Needs attention is a pale coral surface, not a solid block. Buttons are quiet (white, outlined) except the one action that is due. Member colours appear on avatars only. Categories are plain words, and rows are ruled lines rather than cards.

Palette tokens are at the top of `src/styles.css` with their contrast limits: cornflower (4.1:1) and coral (3.3:1) are for fills, edges and icons, not small text.

Type: a bundled display face (Bricolage Grotesque, same-origin) for headings only; the system stack is the fallback. There is no dark mode in this slice.

Screenshots at 390px and 1440px are in `docs/screenshots/`.

## Deploy (Netlify)

New site from the repo, **Base directory** `household`. The `netlify.toml` here supplies the build command, publish directory and Node 22. The site sends `noindex` headers and `robots.txt` disallows crawlers, but the URL itself is public: add Netlify password protection or Identity before putting real household data in.
