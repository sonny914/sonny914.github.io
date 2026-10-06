-- The Cottage: who can do what. Everything below assumes the tables migration has run.

-- ---- Identity helpers --------------------------------------------------------

-- The adult profile linked to the signed-in account, or null for anyone else.
create function public.current_member() returns text
language sql stable security definer set search_path = ''
as $$ select member_id from public.account_links where user_id = auth.uid() $$;

revoke all on function public.current_member() from public, anon;
grant execute on function public.current_member() to authenticated;

-- ---- Invite-only accounts ------------------------------------------------------

-- Refuse to create any account whose e-mail address is not on the invite list.
create function private.guard_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_invites i where i.email = lower(new.email)) then
    raise exception 'This e-mail address is not invited to The Cottage.' using errcode = '42501';
  end if;
  return new;
end $$;

-- Link the new account to the adult named on its invite. The browser never chooses this.
create function private.link_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.account_links (user_id, member_id)
  select new.id, i.member_id from public.household_invites i where i.email = lower(new.email);
  return new;
end $$;

create trigger guard_new_user before insert on auth.users
  for each row execute function private.guard_new_user();
create trigger link_new_user after insert on auth.users
  for each row execute function private.link_new_user();

-- ---- Attribution: always the authenticated account ------------------------------

create function private.stamp_row() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare me text := public.current_member();
begin
  if me is null then
    raise exception 'Only household members can change household information.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := me;
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := me;
  new.updated_at := now();
  return new;
end $$;

create function private.stamp_updated() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare me text := public.current_member();
begin
  if me is null then
    raise exception 'Only household members can change household information.' using errcode = '42501';
  end if;
  new.updated_by := me;
  new.updated_at := now();
  return new;
end $$;

create function private.stamp_mail_check() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare me text := public.current_member();
begin
  if me is null then
    raise exception 'Only household members can change household information.' using errcode = '42501';
  end if;
  new.checked_by := me;
  new.checked_at := now();
  return new;
end $$;

create function private.stamp_setup() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger stamp_work before insert or update on public.work_entries
  for each row execute function private.stamp_row();
create trigger stamp_away before insert or update on public.unavailable_periods
  for each row execute function private.stamp_row();
create trigger stamp_update before insert or update on public.child_updates
  for each row execute function private.stamp_row();
create trigger stamp_contact before update on public.trusted_contacts
  for each row execute function private.stamp_updated();
create trigger stamp_mail before insert on public.mail_checks
  for each row execute function private.stamp_mail_check();
create trigger stamp_setup before insert or update on public.setup_status
  for each row execute function private.stamp_setup();

-- Every child update must name at least one child (checked when the transaction commits).
create function private.require_child_for_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.child_updates u where u.id = new.id)
     and not exists (select 1 from public.child_update_children c where c.update_id = new.id) then
    raise exception 'A child update must be about at least one child.' using errcode = '23514';
  end if;
  return null;
end $$;

create function private.require_child_for_link() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (select 1 from public.child_updates u where u.id = old.update_id)
     and not exists (select 1 from public.child_update_children c where c.update_id = old.update_id) then
    raise exception 'A child update must be about at least one child.' using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger require_child_on_update after insert or update on public.child_updates
  deferrable initially deferred for each row execute function private.require_child_for_update();
create constraint trigger require_child_on_delete after delete on public.child_update_children
  deferrable initially deferred for each row execute function private.require_child_for_link();

-- ---- Row-level security ----------------------------------------------------------

alter table public.members              enable row level security;
alter table public.household_invites    enable row level security;
alter table public.account_links        enable row level security;
alter table public.work_entries         enable row level security;
alter table public.unavailable_periods  enable row level security;
alter table public.child_updates        enable row level security;
alter table public.child_update_children enable row level security;
alter table public.trusted_contacts     enable row level security;
alter table public.setup_status         enable row level security;
alter table public.mail_checks          enable row level security;

-- Browser roles start with nothing. Grants below are the only way in.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;

grant usage on schema public to authenticated;

-- No policy and no grant for household_invites: only the project owner (SQL editor / service role) uses it.

-- Reference data: any household member can read.
grant select on public.members to authenticated;
create policy members_read on public.members for select to authenticated
  using (public.current_member() is not null);

-- An account can read only its own link. Nobody can write it from the browser.
grant select on public.account_links to authenticated;
create policy links_read_own on public.account_links for select to authenticated
  using (user_id = auth.uid());

-- Work schedule: all adults see everyone's; each adult changes only their own.
grant select, insert, update, delete on public.work_entries to authenticated;
create policy work_read   on public.work_entries for select to authenticated using (public.current_member() is not null);
create policy work_insert on public.work_entries for insert to authenticated with check (member_id = public.current_member());
create policy work_update on public.work_entries for update to authenticated
  using (member_id = public.current_member()) with check (member_id = public.current_member());
create policy work_delete on public.work_entries for delete to authenticated using (member_id = public.current_member());

grant select, insert, update, delete on public.unavailable_periods to authenticated;
create policy away_read   on public.unavailable_periods for select to authenticated using (public.current_member() is not null);
create policy away_insert on public.unavailable_periods for insert to authenticated with check (member_id = public.current_member());
create policy away_update on public.unavailable_periods for update to authenticated
  using (member_id = public.current_member()) with check (member_id = public.current_member());
create policy away_delete on public.unavailable_periods for delete to authenticated using (member_id = public.current_member());

-- Child updates: any adult can read, add, edit and delete, for either child.
grant select, insert, update, delete on public.child_updates, public.child_update_children to authenticated;
create policy cu_read   on public.child_updates for select to authenticated using (public.current_member() is not null);
create policy cu_insert on public.child_updates for insert to authenticated with check (public.current_member() is not null);
create policy cu_update on public.child_updates for update to authenticated
  using (public.current_member() is not null) with check (public.current_member() is not null);
create policy cu_delete on public.child_updates for delete to authenticated using (public.current_member() is not null);
create policy cuc_read   on public.child_update_children for select to authenticated using (public.current_member() is not null);
create policy cuc_insert on public.child_update_children for insert to authenticated with check (public.current_member() is not null);
create policy cuc_delete on public.child_update_children for delete to authenticated using (public.current_member() is not null);

-- Trusted contacts: shared. Adults may change phone, e-mail and notes only; no adds or deletes.
grant select on public.trusted_contacts to authenticated;
grant update (phone, email, notes) on public.trusted_contacts to authenticated;
create policy tc_read   on public.trusted_contacts for select to authenticated using (public.current_member() is not null);
create policy tc_update on public.trusted_contacts for update to authenticated
  using (public.current_member() is not null) with check (public.current_member() is not null);

-- First-time setup: each adult manages their own flag.
grant select, insert, update on public.setup_status to authenticated;
create policy setup_read   on public.setup_status for select to authenticated using (member_id = public.current_member());
create policy setup_insert on public.setup_status for insert to authenticated with check (member_id = public.current_member());
create policy setup_update on public.setup_status for update to authenticated
  using (member_id = public.current_member()) with check (member_id = public.current_member());

-- Mail: any adult can log a check; you can only take back your own.
grant select, insert, delete on public.mail_checks to authenticated;
grant usage on sequence public.mail_checks_id_seq to authenticated;
create policy mail_read   on public.mail_checks for select to authenticated using (public.current_member() is not null);
create policy mail_insert on public.mail_checks for insert to authenticated with check (public.current_member() is not null);
create policy mail_delete on public.mail_checks for delete to authenticated using (checked_by = public.current_member());

-- ---- Functions the app calls ------------------------------------------------------

-- Save a child update and its children in one transaction. Runs as the caller, so the policies above apply.
create function public.save_child_update(
  p_id text, p_type text, p_title text, p_note text, p_at timestamp, p_child_ids text[]
) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_child_ids is null or cardinality(p_child_ids) = 0 then
    raise exception 'Choose at least one child.' using errcode = '22023';
  end if;
  insert into public.child_updates (id, type, title, note, at)
  values (p_id, p_type, btrim(p_title), nullif(btrim(coalesce(p_note, '')), ''), p_at)
  on conflict (id) do update
    set type = excluded.type, title = excluded.title, note = excluded.note, at = excluded.at;
  delete from public.child_update_children where update_id = p_id and not (child_id = any (p_child_ids));
  insert into public.child_update_children (update_id, child_id)
  select p_id, c from unnest(p_child_ids) as c
  on conflict do nothing;
end $$;

-- Take back the latest mail check, but only if it was yours.
create function public.undo_mail_check() returns boolean
language plpgsql security invoker set search_path = ''
as $$
declare n int;
begin
  delete from public.mail_checks
  where id = (select id from public.mail_checks order by checked_at desc, id desc limit 1)
    and checked_by = public.current_member();
  get diagnostics n = row_count;
  return n > 0;
end $$;

revoke all on function public.save_child_update(text, text, text, text, timestamp, text[]) from public, anon;
revoke all on function public.undo_mail_check() from public, anon;
grant execute on function public.save_child_update(text, text, text, text, timestamp, text[]) to authenticated;
grant execute on function public.undo_mail_check() to authenticated;
