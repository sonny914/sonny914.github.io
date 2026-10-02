# The Cottage

Private, phone-first coordination for one home: three adults (Jay, Fallon, Breeze), two children (Khodi, Kenzli) and a trusted backup nanny (Fran).
**Mock data and demo behaviour only.** No real sign-in, no shared database, no integrations, OCR, calendar sync or notifications. See "What is demo and what is shared" below before relying on anything.

## Run

```bash
cd household
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for a phone)
npm run validate   # typecheck + oxlint + tests + production build
```

## What this slice does

- **Who are you?** A first screen with Jay, Fallon and Breeze, then **Add your work schedule** (manual entry, or Skip for now). Returning adults go straight to Home. **Switch person** (Household, This device) or the Viewing-as selector changes who is using the app.
- **Manual schedule:** date, start, end, optional weekly repeat (pick days, optional end date); edit or delete. Same-day only, so overnight shifts are rejected with a message. Shifts appear on Home. Adults edit only their own schedule and unavailable times; unavailable times feed the "who can cover" line on coverage items.
- **Household profiles:** Jay, Fallon, Breeze, Khodi and Kenzli. Each child has an Updates area. Any adult can add an update (school, appointment, therapy, reminder or general note) with a title, optional note and optional date/time, for one child or both twins. A two-child update is one record. Each record shows who added it and who last edited it. A dated update appears on the shared calendar as one derived event that is rebuilt from the record, so editing never duplicates it.
- **Fran** is listed under Trusted contacts as the preferred backup nanny. Her details start empty and adults fill them in. Contacting her never counts as confirmed childcare: she is not an assignee, a claim naming her is ignored, and coverage stays open until an adult records who is covering.
- **Saving:** every write either succeeds (a short "saved on this device only" confirmation) or fails loudly ("Couldn't save…") and keeps the form open with what was typed.
- Not in this slice: photo/PDF upload and schedule extraction (there is deliberately no upload button), pattern learning, automatic coverage suggestions, notifications.

## What is demo and what is shared

| | This slice | Shared across devices? |
|---|---|---|
| Choosing who you are | Name stored in this browser. **Not a sign-in**: no password, no proof of identity | No |
| Schedules, unavailable times, child updates, Fran's details, coverage and mail actions | Stored in this browser's localStorage (`cottage.demo.v1`) | **No.** Another phone or browser starts empty |
| Created-by / edited-by | Recorded from the chosen name | Only on this device |
| Seed data (sample shifts, events, coverage needs) | Generated relative to today on every load | n/a |

## External setup still required for real accounts and shared saving

Nothing in the repo is configured for a backend (no client, no env vars). To make sign-in real and saving shared you need:

1. A **new, dedicated Supabase project for The Cottage** (not the Quiet Bands project), or another auth plus database service.
2. **Auth:** enable e-mail sign-in (magic link), add your Netlify site URL to the allowed redirect URLs, and invite the three adults' e-mail addresses (only invited addresses may sign up).
3. **Tables** that mirror `src/data/types.ts`: a member link (auth user to `jay` / `fallon` / `adult3`, one user per member), work entries, unavailable periods, child updates, trusted contacts, coverage claims, setup status, mail check. **Row-level security** so only the three linked users can read or write, and writes record `createdBy` / `updatedBy`.
4. **Environment variables** on Netlify: the project URL and anon key.
5. **Code:** implement the `'account'` `AuthService` (`src/auth/auth.ts`) and an async repository behind the existing `HouseholdRepository` interface. Components and the member IDs (`jay`, `fallon`, `adult3`, `khodi`, `kenzli`) do not change.

Until then, treat everything as a single-device demo.

## Structure

- `src/auth/auth.ts` the auth seam. Only the `'demo'` implementation exists
- `src/data/types.ts` domain model, including work entries, unavailable periods, child updates, trusted contacts and audit stamps
- `src/data/members.ts` the five profiles (Kenzli's initial is "D", for Ducki; Breeze's id stays `adult3`)
- `src/data/seed.ts` sample household, generated relative to today
- `src/data/demoState.ts` pure overlay of everything people changed, and `applyDemoState`, which rebuilds derived events by id
- `src/data/repository.ts` the only storage seam. Writes throw `StorageError` on failure
- `src/lib/` dates, selectors (today, upcoming, attention, who can cover), `schedules.ts` (shift rules and recurrence), `records.ts` (stamps and attribution)
- `src/components/`, `src/screens/` UI. Home, Household and first-time setup are functional; Calendar and Coverage are placeholders

## Design

A day board, not a dashboard. Warm white dominates; navy for text, structure and navigation; cornflower for selected and interactive states; coral only for unresolved responsibilities (edge, icon, dot, never text). Buttons are quiet except the one action that is due. Type scale 12 / 14 / 16 / 18 / 24 / 34 (52 on desktop). Palette tokens and their contrast limits are at the top of `src/styles.css`. No dark mode in this slice.

Screenshots (390px phone) are in `docs/screenshots/`.

## Deploy (Netlify)

New site from the repo, **Base directory** `household`. The `netlify.toml` supplies the build command, publish directory, Node 22, noindex and security headers. The URL is public, so add password protection or Identity before putting real household data in.
