# The Cottage

Private, phone-first coordination for one home: three adults (Jay, Fallon, Breeze), two children (Khodi, Kenzli) and a trusted backup nanny (Fran).

The app runs in one of two modes, chosen by two environment variables:

| | Demo (no variables) | Shared (Supabase configured) |
|---|---|---|
| Who you are | Pick a name. **Not a sign-in.** Stored in this browser | **E-mail sign-in.** Your account is linked to exactly one adult by the database; there is nothing to pick |
| Where data lives | This browser's localStorage (`cottage.demo.v1`) | Your Supabase Postgres, shared by all three adults |
| Sample events and coverage needs | Generated relative to today | None. A new shared household starts empty |
| Coverage claims, "confirmed", needs | Work (single device) | **Not shared yet.** The app says so rather than pretending |

## Run

```bash
cd household
npm install
npm run dev        # http://localhost:5173 (also on your LAN, for a phone)
npm run validate   # typecheck + oxlint + tests + production build + secret scan
```

## Set up shared accounts and storage (Supabase)

Do this in a **new, dedicated Supabase project for The Cottage**. Do not reuse any other project (for example the Quiet Bands ones): this holds a family's schedule and the row-level security is written for this schema only.

1. **Create the project.** supabase.com, New project. Note the project URL and, under Project Settings > API, the **anon / publishable** key.
2. **Run the migrations**, in order, in the SQL editor (or `supabase db push` with the CLI):
   - `supabase/migrations/20261003000100_cottage_tables.sql`
   - `supabase/migrations/20261003000200_cottage_access.sql`
   - `supabase/migrations/20261003000300_cottage_birthdays.sql`
3. **Invite the three adults.** Copy `supabase/invites.example.sql`, replace the three placeholder addresses with their real e-mail addresses, and run it. This table is the whole allow-list: Jay's address becomes `jay`, Fallon's `fallon`, Breeze's `adult3`. No one else can ever get an account, because a database trigger rejects any e-mail address not in it. Nothing in the app can read or edit this table.
4. **Auth settings** (Authentication in the dashboard):
   - Providers > Email: enabled. Turn **off** "Allow new users to sign up" (belt and braces; the trigger already refuses uninvited addresses).
   - URL Configuration: set **Site URL** to your Netlify URL and add it (and `http://localhost:5173` if you want local development) to **Redirect URLs**.
   - Email Templates > Magic Link: make sure the body includes `{{ .Token }}` so people can type the 6-digit code as well as click the link.
   - Users > Add user (or Invite user) for each of the three invited addresses. The sign-in screen only signs in addresses that already exist.
5. **Environment variables** (Netlify: Site configuration > Environment variables; locally `.env.local`, see `.env.example`):
   - `VITE_SUPABASE_URL` the project URL, `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` the anon / publishable key
   - Then redeploy. With both set the app runs in shared mode; with neither it is the demo. Setting only one shows an error rather than quietly falling back.
6. **Never** put the `service_role` or `sb_secret_…` key in Netlify's `VITE_` variables, in the code or in a commit. The app refuses to start with one, and `npm run validate` scans the source and the built bundle for one and fails.

### What the database enforces (it does not trust the browser)

- Only the three invited addresses can have accounts; each is linked to its adult by a row only a trigger can write.
- All three adults can read everything in the household.
- An adult can create, edit and delete **only their own** work schedule and unavailable times.
- Any adult can add or edit an update for either child (one record for both twins). Fran's phone, e-mail and notes can be edited by any adult; her name and role cannot.
- `created_by` / `updated_by` and times are set by the database from the signed-in account. Whatever the browser sends is ignored.
- Anonymous visitors can read and write nothing.
- Shifts have a start date and an explicit end date, so a shift crossing midnight is stored as such. A shift must end after it starts and last at most 24 hours.

### Existing records on a device

Records saved by the earlier single-device demo are **never uploaded automatically**. After a person signs in on a device that holds some, a review screen lists them with nothing selected. They choose what to import. Records are saved as added by the signed-in account, only your own schedule can be imported, anything already in the household is skipped (so repeating it is harmless), and Fran's details only fill empty fields. Removing the local copies is a separate, confirmed step. Household > This device > "Review records on this device" reopens it.

### Birthdays and pickups

Trash (Tuesday and Friday) and recycling (Friday) reminders appear on Home from 5 PM the evening before until 10 AM on pickup day. Starting birthdays (Jay, Fallon, Khodi and Kenzli) and the pickup days are rules in `src/lib/routines.ts`. Any adult whose birthday isn't known (today, Breeze) is asked for it, month and day only, during first-time setup, and can skip. Each adult can set only their own.

### Fran

A shared trusted contact with no availability tracking. Contacting her is not coverage: she is not an assignee and nothing about her changes who is covering.

## Verified and not verified

Verified by automated tests with no credentials. The real migrations run in an in-process Postgres (PGlite) as separate database users, behind the real repository and the real sign-in code, and the UI is driven for two people at once:

- Account isolation: each account resolves to its own adult only; a signed-in stranger with no link sees nothing; anonymous sees nothing; leftover demo choices cannot change identity.
- Shared updates across two sessions: Jay saves, Fallon sees it after refresh; Breeze updates a child, Jay sees it attributed to Breeze.
- Fallon cannot edit Jay's schedule, in the UI or by forging a request; forged `created_by` is overwritten.
- An uninvited e-mail cannot get an account; invites cannot be read or edited by signed-in users.
- Overnight shifts with an explicit end date, in the form, the rules and the database.
- A failed save (network or permission) shows an error, saves nothing and keeps everything typed in the form.
- Demo records are not uploaded without review; import is per item, own-only and idempotent.
- A service-role key is refused at start-up, and a scan fails the build if one is in the code or bundle.

**Not verified. Blocked until a Supabase project exists:**

- Real Supabase Auth (GoTrue): e-mail delivery, the actual magic link and 6-digit code, the "sign-ups disabled" setting, redirect URL handling and the e-mail template.
- JWT issuing and verification, and PostgREST itself (HTTP routing, how `upsert` and RPC calls are serialised). The tests use a stand-in that runs the same SQL as the signed-in user.
- Netlify with the real variables (CSP allows `https://*.supabase.co`; this has not been exercised in a browser against a real project).
- Real-device behaviour of sign-in links on a phone.

Known limits: other people's changes appear when you return to the tab or within a minute (polling, not realtime). Shifts show on their start day only. Editing a repeating shift edits the whole series. Coverage needs and confirmations, the calendar and the coverage tab are not shared records yet. The Add sheet is still a placeholder. No photo or PDF import.

## Structure

- `supabase/migrations/` tables, row-level security, triggers and RPCs. `supabase/invites.example.sql` the allow-list template
- `src/config.ts` reads the two public variables; refuses privileged keys. `src/services.ts` builds demo or shared services
- `src/auth/` the auth seam: `createDemoAuth` (not a sign-in) and `createAccountAuth` (real e-mail sign-in; identity from the database)
- `src/data/repository.ts` the async repository interface and the local demo repository. `supabaseRepository.ts` the shared one
- `src/data/types.ts`, `members.ts`, `seed.ts`, `demoState.ts` domain model and demo data. Member IDs (`jay`, `fallon`, `adult3`, `khodi`, `kenzli`) are stable
- `src/import/plan.ts` the reviewed-import rules
- `src/db/` test-only PGlite harness for the migrations (not bundled)
- `src/lib/` dates, selectors, shift rules (`schedules.ts`), attribution
- `src/components/`, `src/screens/` UI

## Design

A day board, not a dashboard. Warm white dominates; navy for text, structure and navigation; cornflower for selected and interactive states; coral only for unresolved responsibilities (edge, icon, dot, never text). Buttons are quiet except the one action that is due. Type scale 12 / 14 / 16 / 18 / 24 / 34 (52 on desktop). Palette tokens and their contrast limits are at the top of `src/styles.css`.

## Deploy (Netlify)

New site from the repo, **Base directory** `household`. The `netlify.toml` supplies the build command, publish directory, Node 22, noindex and security headers (including a CSP that allows only this origin and `https://*.supabase.co`). Add the two environment variables above. In demo mode the URL is public and the data is local to each browser; in shared mode only the three invited adults can sign in.
