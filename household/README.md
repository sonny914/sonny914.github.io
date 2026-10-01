# Home base — household app (slice 1)

Private, phone-first coordination for one home: three adults (Jay, Fallon, Adult 3) and two children (Khodi, Kenzli).
Slice 1 is the app shell and the Home dashboard. **Mock data only**: no auth, database, integrations, OCR, calendar sync or notifications.

## Run

```bash
cd household
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for a phone)
npm run typecheck  # tsc --noEmit
npm test           # vitest: schedule/attention logic
npm run build      # typecheck + production build into dist/
```

## Layout

- `src/data/types.ts` domain model (members, events, confirmation, coverage requests, reminders, uploaded schedules)
- `src/data/members.ts` the five profiles; **rename Adult 3 via `ADULT_3_NAME`**
- `src/data/seed.ts` sample household, generated relative to today
- `src/data/repository.ts` the only seam to storage; swap for a database here
- `src/lib/` date helpers and pure selectors (today, upcoming, needs-attention, mail)
- `src/components/`, `src/screens/` small UI pieces; Home is functional, other tabs are placeholders

Only the mail check is persisted (localStorage key `household.demo.mailCheck.v1`). "Undo" on the mail card clears it.
