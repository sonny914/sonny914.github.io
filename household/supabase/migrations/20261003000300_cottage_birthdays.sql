-- Each adult can tell the household their own birthday during first-time setup. Month and day only.
-- The household's starting birthdays live in the app; a row here replaces the starting one for that person.
create table public.member_birthdays (
  member_id  text primary key references public.members (id),
  month      smallint not null check (month between 1 and 12),
  day        smallint not null check (day between 1 and (array[31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])[month]),
  updated_at timestamptz not null default now()
);

create trigger stamp_birthday before insert or update on public.member_birthdays
  for each row execute function private.stamp_setup();

alter table public.member_birthdays enable row level security;
revoke all on public.member_birthdays from anon, public;
grant select, insert, update (month, day) on public.member_birthdays to authenticated;

-- Everyone in the household can read them; you can only set your own.
create policy bd_read   on public.member_birthdays for select to authenticated using (public.current_member() is not null);
create policy bd_insert on public.member_birthdays for insert to authenticated with check (member_id = public.current_member());
create policy bd_update on public.member_birthdays for update to authenticated
  using (member_id = public.current_member()) with check (member_id = public.current_member());
