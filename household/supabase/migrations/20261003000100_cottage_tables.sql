-- The Cottage: shared household data. Run on a DEDICATED Supabase project
-- (never one used by another product). Tables first; access rules are in the next migration.
--
-- Conventions
--  * member ids are stable text keys that match the app: jay, fallon, adult3 (Breeze), khodi, kenzli.
--  * "wall clock" values (shifts, appointments) are `timestamp` / `date` / `time` WITHOUT time zone:
--    one home, one zone. Only audit stamps use timestamptz.
--  * Attribution columns (created_by, updated_by, created_at, updated_at) are written by triggers
--    from the authenticated account. Clients cannot choose them.

create schema if not exists private;

-- ---- People ----------------------------------------------------------------

create table public.members (
  id   text primary key check (id ~ '^[a-z0-9]+$'),
  name text not null,
  role text not null check (role in ('adult', 'child')),
  unique (id, role)
);

insert into public.members (id, name, role) values
  ('jay',    'Jay',    'adult'),
  ('fallon', 'Fallon', 'adult'),
  ('adult3', 'Breeze', 'adult'),
  ('khodi',  'Khodi',  'child'),
  ('kenzli', 'Kenzli', 'child');

-- Who may ever have an account. Filled by the project owner (see supabase/invites.example.sql).
-- Not readable or writable by any browser role.
create table public.household_invites (
  email      text primary key check (email = lower(email) and position('@' in email) > 1),
  member_id  text not null unique,
  adult_role text not null default 'adult' check (adult_role = 'adult'),
  foreign key (member_id, adult_role) references public.members (id, role)
);

-- Which adult each authenticated account is. Written only by a trigger on auth.users,
-- from the invite for that e-mail address. Clients can read their own row and nothing else.
create table public.account_links (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  member_id  text not null unique,
  adult_role text not null default 'adult' check (adult_role = 'adult'),
  foreign key (member_id, adult_role) references public.members (id, role)
);

-- ---- Work schedule -----------------------------------------------------------

-- One shift, or a weekly pattern of shifts. A shift may cross midnight: the end date is explicit.
-- For a weekly pattern, end_date - start_date is the number of days each occurrence runs over.
create table public.work_entries (
  id              text primary key check (length(id) between 3 and 80),
  member_id       text not null,
  member_role     text not null default 'adult' check (member_role = 'adult'),
  start_date      date not null,
  start_time      time not null,
  end_date        date not null,
  end_time        time not null,
  repeat_weekdays smallint[] check (
    repeat_weekdays is null
    or (cardinality(repeat_weekdays) between 1 and 7 and repeat_weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
  ),
  repeat_until    date,
  created_by      text not null references public.members (id),
  created_at      timestamptz not null,
  updated_by      text not null references public.members (id),
  updated_at      timestamptz not null,
  foreign key (member_id, member_role) references public.members (id, role),
  constraint shift_runs_forward check ((end_date + end_time) > (start_date + start_time)),
  constraint shift_at_most_24h check ((end_date + end_time) - (start_date + start_time) <= interval '24 hours'),
  constraint repeat_until_not_before_start check (repeat_until is null or repeat_until >= start_date)
);

create table public.unavailable_periods (
  id          text primary key check (length(id) between 3 and 80),
  member_id   text not null,
  member_role text not null default 'adult' check (member_role = 'adult'),
  start_at    timestamp not null,
  end_at      timestamp not null,
  all_day     boolean not null default false,
  note        text check (note is null or length(note) <= 500),
  created_by  text not null references public.members (id),
  created_at  timestamptz not null,
  updated_by  text not null references public.members (id),
  updated_at  timestamptz not null,
  foreign key (member_id, member_role) references public.members (id, role),
  constraint unavailable_runs_forward check (end_at >= start_at)
);

-- ---- Child updates -----------------------------------------------------------

-- One record per update, however many children it is about (both twins = one row).
create table public.child_updates (
  id         text primary key check (length(id) between 3 and 80),
  type       text not null check (type in ('school', 'appointment', 'therapy', 'reminder', 'note')),
  title      text not null check (length(btrim(title)) between 1 and 200),
  note       text check (note is null or length(note) <= 4000),
  at         timestamp,
  created_by text not null references public.members (id),
  created_at timestamptz not null,
  updated_by text not null references public.members (id),
  updated_at timestamptz not null
);

create table public.child_update_children (
  update_id  text not null references public.child_updates (id) on delete cascade,
  child_id   text not null,
  child_role text not null default 'child' check (child_role = 'child'),
  primary key (update_id, child_id),
  foreign key (child_id, child_role) references public.members (id, role)
);

-- ---- Trusted contacts --------------------------------------------------------

-- Someone the household may call. Not a member and never an assignee. Availability tracking
-- is deliberately not modelled yet. Contacting a contact never counts as confirmed childcare.
create table public.trusted_contacts (
  id           text primary key,
  name         text not null,
  role         text not null,
  relationship text,
  phone        text check (phone is null or length(phone) <= 50),
  email        text check (email is null or length(email) <= 254),
  notes        text check (notes is null or length(notes) <= 2000),
  updated_by   text references public.members (id),
  updated_at   timestamptz
);

-- Contact details start empty. Nothing about Fran is invented.
insert into public.trusted_contacts (id, name, role, relationship) values
  ('fran', 'Fran', 'Preferred backup nanny', 'Their only nanny since birth');

-- ---- First-time setup and mail ------------------------------------------------

create table public.setup_status (
  member_id  text primary key references public.members (id),
  status     text not null check (status in ('done', 'skipped')),
  updated_at timestamptz not null default now()
);

-- A log of who checked the physical mail and when. The latest row is the current status.
create table public.mail_checks (
  id         bigint generated always as identity primary key,
  checked_by text not null references public.members (id),
  checked_at timestamptz not null default now()
);
