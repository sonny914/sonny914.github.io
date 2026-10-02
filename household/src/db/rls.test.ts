import { beforeEach, describe, expect, it } from 'vitest';
import { createCottage, createHousehold } from './testDb';

type H = Awaited<ReturnType<typeof createHousehold>>;
let h: H;
beforeEach(async () => {
  h = await createHousehold();
}, 60_000);

const shift = (id: string, member: string, extra = '') =>
  `insert into public.work_entries (id, member_id, start_date, start_time, end_date, end_time ${extra ? ', ' + extra.split('|')[0] : ''})
   values ('${id}', '${member}', '2026-10-02', '09:00', '2026-10-02', '17:00' ${extra ? ', ' + extra.split('|')[1] : ''})`;

describe('invite-only accounts', () => {
  it('refuses any e-mail address that is not on the invite list', async () => {
    await expect(h.addUser('stranger@elsewhere.test')).rejects.toThrow(/not invited/i);
    await expect(h.addUser('JAY@cottage.test.evil')).rejects.toThrow(/not invited/i);
  });

  it('links each invited account to its own adult profile, ignoring e-mail case', async () => {
    const links = await h.admin.query<{ member_id: string; user_id: string }>('select user_id, member_id from public.account_links');
    const byUser = Object.fromEntries(links.map((l) => [l.user_id, l.member_id]));
    expect(byUser[h.ids.jay]).toBe('jay');
    expect(byUser[h.ids.fallon]).toBe('fallon');
    expect(byUser[h.ids.breeze]).toBe('adult3');
    expect(links).toHaveLength(3);
  });

  it('allows only one account per adult', async () => {
    await expect(h.addUser('jay@cottage.test')).rejects.toThrow(/unique|duplicate/i);
  });

  it('only adults can be invited, so a child can never have an account', async () => {
    await expect(h.admin.exec(`insert into public.household_invites (email, member_id) values ('kid@cottage.test', 'khodi')`)).rejects.toThrow();
  });

  it('keeps the invite list out of reach of every browser role', async () => {
    await expect(h.jay.query('select * from public.household_invites')).rejects.toThrow(/permission denied/i);
    await expect(h.jay.exec(`insert into public.household_invites (email, member_id) values ('x@y.test', 'jay')`)).rejects.toThrow(/permission denied/i);
    await expect(h.anon.query('select * from public.household_invites')).rejects.toThrow(/permission denied/i);
  });
});

describe('identity cannot be chosen or changed from the browser', () => {
  it('each account sees only its own link, and current_member() matches it', async () => {
    expect(await h.jay.query('select member_id from public.account_links')).toEqual([{ member_id: 'jay' }]);
    expect(await h.fallon.query('select member_id from public.account_links')).toEqual([{ member_id: 'fallon' }]);
    expect(await h.breeze.query('select public.current_member() as me')).toEqual([{ me: 'adult3' }]);
  });

  it('refuses to write, change or delete links', async () => {
    await expect(h.jay.exec(`update public.account_links set member_id = 'fallon'`)).rejects.toThrow(/permission denied/i);
    await expect(h.jay.exec(`insert into public.account_links (user_id, member_id) values ('${h.ids.jay}', 'fallon')`)).rejects.toThrow(/permission denied/i);
    await expect(h.jay.exec(`delete from public.account_links`)).rejects.toThrow(/permission denied/i);
    expect(await h.admin.query('select member_id from public.account_links where user_id = $1', [h.ids.jay])).toEqual([{ member_id: 'jay' }]);
  });

  it('refuses to edit reference data, call private helpers or touch the schema', async () => {
    await expect(h.jay.exec(`update public.members set name = 'Someone'`)).rejects.toThrow(/permission denied/i);
    await expect(h.jay.query('select private.guard_new_user()')).rejects.toThrow(/permission denied/i);
  });

  it('gives nothing to someone who is signed in but not linked to a profile', async () => {
    const orphan = await h.db.query<{ id: string }>(`insert into auth.users (email) values ('jay@cottage.test') on conflict do nothing returning id`).catch(() => ({ rows: [] }));
    expect(orphan.rows).toHaveLength(0);
    const ghost = h.as('00000000-0000-0000-0000-00000000dead');
    expect(await ghost.query('select * from public.work_entries')).toEqual([]);
    expect(await ghost.query('select * from public.child_updates')).toEqual([]);
    await expect(ghost.exec(shift('ghost-1', 'jay'))).rejects.toThrow(/row-level security|household members/i);
  });

  it('gives nothing to a browser that is not signed in', async () => {
    await expect(h.anon.query('select * from public.work_entries')).rejects.toThrow(/permission denied/i);
    await expect(h.anon.query('select * from public.trusted_contacts')).rejects.toThrow(/permission denied/i);
    await expect(h.anon.exec(shift('anon-1', 'jay'))).rejects.toThrow(/permission denied/i);
  });
});

describe('work schedules: everyone sees, only the owner edits', () => {
  it('all three adults can see a shift one of them adds', async () => {
    await h.jay.exec(shift('wk-jay-1', 'jay'));
    for (const who of [h.jay, h.fallon, h.breeze]) {
      expect((await who.query('select id, member_id from public.work_entries')).map((r) => (r as { id: string }).id)).toEqual(['wk-jay-1']);
    }
  });

  it('refuses to create, edit, steal or delete another adult\'s shift', async () => {
    await h.jay.exec(shift('wk-jay-1', 'jay'));
    await expect(h.fallon.exec(shift('wk-fake', 'jay'))).rejects.toThrow(/row-level security/i);
    expect(await h.fallon.query(`update public.work_entries set end_time = '23:00' where id = 'wk-jay-1' returning id`)).toEqual([]);
    expect(await h.fallon.query(`update public.work_entries set member_id = 'fallon' where id = 'wk-jay-1' returning id`)).toEqual([]);
    expect(await h.fallon.query(`delete from public.work_entries where id = 'wk-jay-1' returning id`)).toEqual([]);
    const row = (await h.admin.query<{ member_id: string; end_time: string }>(`select member_id, end_time from public.work_entries where id = 'wk-jay-1'`))[0]!;
    expect(row).toMatchObject({ member_id: 'jay', end_time: '17:00:00' });
  });

  it('refuses to move the owner\'s own shift onto someone else', async () => {
    await h.jay.exec(shift('wk-jay-1', 'jay'));
    await expect(h.jay.exec(`update public.work_entries set member_id = 'fallon' where id = 'wk-jay-1'`)).rejects.toThrow(/row-level security/i);
  });

  it('lets the owner edit and delete their own shift', async () => {
    await h.jay.exec(shift('wk-jay-1', 'jay'));
    expect(await h.jay.query(`update public.work_entries set end_time = '16:30' where id = 'wk-jay-1' returning end_time`)).toEqual([{ end_time: '16:30:00' }]);
    expect(await h.jay.query(`delete from public.work_entries where id = 'wk-jay-1' returning id`)).toEqual([{ id: 'wk-jay-1' }]);
  });

  it('applies the same rule to unavailable times', async () => {
    await h.breeze.exec(`insert into public.unavailable_periods (id, member_id, start_at, end_at, all_day, note) values ('un-1', 'adult3', '2026-10-08 00:00', '2026-10-08 00:00', true, 'Trip')`);
    expect(await h.jay.query('select id from public.unavailable_periods')).toEqual([{ id: 'un-1' }]);
    expect(await h.jay.query(`delete from public.unavailable_periods returning id`)).toEqual([]);
    await expect(h.jay.exec(`insert into public.unavailable_periods (id, member_id, start_at, end_at) values ('un-2', 'adult3', '2026-10-09 08:00', '2026-10-09 09:00')`)).rejects.toThrow(/row-level security/i);
  });
});

describe('shifts that cross midnight carry an explicit end date', () => {
  const insert = (end: string, endTime: string, extra = '') =>
    `insert into public.work_entries (id, member_id, start_date, start_time, end_date, end_time ${extra ? ', ' + extra.split('|')[0] : ''})
     values ('wk-n', 'jay', '2026-10-02', '22:00', '${end}', '${endTime}' ${extra ? ', ' + extra.split('|')[1] : ''})`;

  it('accepts 10 PM to 6 AM the next day, one-off and weekly', async () => {
    await h.jay.exec(insert('2026-10-03', '06:00'));
    expect(await h.jay.query(`select end_date::text as e, end_time::text as t from public.work_entries`)).toEqual([{ e: '2026-10-03', t: '06:00:00' }]);
    await h.jay.exec(`delete from public.work_entries`);
    await h.jay.exec(insert('2026-10-03', '06:00', 'repeat_weekdays|array[1,3,5]'));
  });

  it('rejects an end that is not after the start, and a shift longer than 24 hours', async () => {
    await expect(h.jay.exec(insert('2026-10-02', '06:00'))).rejects.toThrow(/shift_runs_forward/);
    await expect(h.jay.exec(insert('2026-10-02', '22:00'))).rejects.toThrow(/shift_runs_forward/);
    await expect(h.jay.exec(insert('2026-10-04', '06:00'))).rejects.toThrow(/shift_at_most_24h/);
  });
});

describe('attribution comes from the authenticated account, not from the request', () => {
  it('ignores created_by / updated_by supplied by the browser', async () => {
    await h.jay.exec(shift('wk-1', 'jay', `created_by, updated_by, created_at, updated_at|'fallon', 'fallon', '2001-01-01', '2001-01-01'`));
    const r = (await h.admin.query<{ created_by: string; updated_by: string; created_at: string }>(`select created_by, updated_by, created_at::text from public.work_entries`))[0]!;
    expect(r).toMatchObject({ created_by: 'jay', updated_by: 'jay' });
    expect(r.created_at).not.toMatch(/^2001/);
  });

  it('records who last edited a child update and keeps the original author', async () => {
    await h.breeze.query(`select public.save_child_update('cu-1', 'appointment', 'Dentist', 'Bring card', '2026-10-06 09:00', array['khodi','kenzli'])`);
    await h.fallon.query(`select public.save_child_update('cu-1', 'appointment', 'Dentist (moved)', null, '2026-10-07 10:00', array['khodi','kenzli'])`);
    const r = (await h.jay.query<{ created_by: string; updated_by: string; title: string; created_at: string; updated_at: string }>(`select created_by, updated_by, title, created_at::text, updated_at::text from public.child_updates`))[0]!;
    expect(r).toMatchObject({ created_by: 'adult3', updated_by: 'fallon', title: 'Dentist (moved)' });
    expect(r.updated_at >= r.created_at).toBe(true);
  });

  it('cannot forge who checked the mail', async () => {
    await h.jay.exec(`insert into public.mail_checks (checked_by) values ('fallon')`);
    expect(await h.fallon.query('select checked_by from public.mail_checks')).toEqual([{ checked_by: 'jay' }]);
  });
});

describe('child updates are one shared record, editable by any adult for either child', () => {
  it('stores an update for both twins once and shows it to every adult', async () => {
    await h.jay.query(`select public.save_child_update('cu-1', 'school', 'Picture day', 'Blue shirt', '2026-10-02 08:00', array['khodi','kenzli'])`);
    for (const who of [h.jay, h.fallon, h.breeze]) {
      expect(await who.query('select id from public.child_updates')).toEqual([{ id: 'cu-1' }]);
      expect((await who.query('select child_id from public.child_update_children order by child_id')).map((r) => (r as { child_id: string }).child_id)).toEqual(['kenzli', 'khodi']);
    }
  });

  it('lets another adult change the children and the text, without creating a second record', async () => {
    await h.jay.query(`select public.save_child_update('cu-1', 'school', 'Picture day', null, null, array['khodi','kenzli'])`);
    await h.breeze.query(`select public.save_child_update('cu-1', 'school', 'Picture day (Khodi only)', 'Moved', null, array['khodi'])`);
    expect(await h.fallon.query('select id, title from public.child_updates')).toEqual([{ id: 'cu-1', title: 'Picture day (Khodi only)' }]);
    expect(await h.fallon.query('select child_id from public.child_update_children')).toEqual([{ child_id: 'khodi' }]);
  });

  it('lets any adult delete an update, which removes its child links', async () => {
    await h.jay.query(`select public.save_child_update('cu-1', 'note', 'Note', null, null, array['kenzli'])`);
    await h.fallon.exec(`delete from public.child_updates where id = 'cu-1'`);
    expect(await h.breeze.query('select * from public.child_update_children')).toEqual([]);
  });

  it('refuses an update with no child, a bad type, or a non-child', async () => {
    await expect(h.jay.query(`select public.save_child_update('cu-2', 'note', 'X', null, null, array[]::text[])`)).rejects.toThrow(/at least one child/i);
    await expect(h.jay.query(`select public.save_child_update('cu-2', 'party', 'X', null, null, array['khodi'])`)).rejects.toThrow(/check/i);
    await expect(h.jay.query(`select public.save_child_update('cu-2', 'note', 'X', null, null, array['jay'])`)).rejects.toThrow(/foreign key|child_role|violates/i);
    expect(await h.jay.query('select * from public.child_updates')).toEqual([]);
  });

  it('refuses a child update row inserted directly with no child (checked at commit)', async () => {
    await expect(h.jay.exec(`begin; insert into public.child_updates (id, type, title) values ('cu-3', 'note', 'Orphan'); commit;`)).rejects.toThrow(/at least one child/i);
    expect(await h.jay.query('select * from public.child_updates')).toEqual([]);
  });
});

describe('Fran, the shared trusted contact', () => {
  it('starts with no contact details and no availability', async () => {
    const f = (await h.jay.query<Record<string, unknown>>(`select * from public.trusted_contacts where id = 'fran'`))[0]!;
    expect(f).toMatchObject({ name: 'Fran', role: 'Preferred backup nanny', phone: null, email: null, notes: null });
    const cols = (await h.admin.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'trusted_contacts'`)).map((c) => c.column_name);
    expect(cols.filter((c) => /avail|confirm|assign/i.test(c))).toEqual([]);
  });

  it('lets any adult add details, shared with the others, attributed to the account', async () => {
    await h.breeze.exec(`update public.trusted_contacts set phone = '555-0142', notes = 'Prefers text' where id = 'fran'`);
    const seen = (await h.fallon.query<{ phone: string; updated_by: string }>(`select phone, updated_by from public.trusted_contacts where id = 'fran'`))[0]!;
    expect(seen).toEqual({ phone: '555-0142', updated_by: 'adult3' });
  });

  it('cannot be renamed, re-roled, added to or deleted from the browser', async () => {
    await expect(h.jay.exec(`update public.trusted_contacts set name = 'Someone Else'`)).rejects.toThrow(/permission denied/i);
    await expect(h.jay.exec(`update public.trusted_contacts set role = 'Primary'`)).rejects.toThrow(/permission denied/i);
    await expect(h.jay.exec(`insert into public.trusted_contacts (id, name, role) values ('x', 'X', 'Y')`)).rejects.toThrow(/permission denied|row-level security/i);
    await expect(h.jay.exec(`delete from public.trusted_contacts`)).rejects.toThrow(/permission denied/i);
  });
});

describe('first-time setup and mail', () => {
  it('lets each adult read and write only their own setup flag', async () => {
    await h.jay.exec(`insert into public.setup_status (member_id, status) values ('jay', 'skipped')`);
    await expect(h.jay.exec(`insert into public.setup_status (member_id, status) values ('fallon', 'done')`)).rejects.toThrow(/row-level security/i);
    expect(await h.fallon.query('select * from public.setup_status')).toEqual([]);
    expect(await h.jay.query('select member_id, status from public.setup_status')).toEqual([{ member_id: 'jay', status: 'skipped' }]);
  });

  it('shares the mail status and lets only the person who checked take it back', async () => {
    await h.jay.exec(`insert into public.mail_checks default values`);
    expect(await h.breeze.query('select checked_by from public.mail_checks order by id desc limit 1')).toEqual([{ checked_by: 'jay' }]);
    expect(await h.fallon.query('select public.undo_mail_check() as undone')).toEqual([{ undone: false }]);
    expect(await h.admin.query('select count(*)::int as n from public.mail_checks')).toEqual([{ n: 1 }]);
    expect(await h.jay.query('select public.undo_mail_check() as undone')).toEqual([{ undone: true }]);
    expect(await h.admin.query('select count(*)::int as n from public.mail_checks')).toEqual([{ n: 0 }]);
  });
});

describe('migrations', () => {
  it('apply cleanly to an empty database and leave no browser-readable table without row-level security', async () => {
    const c = await createCottage();
    const rows = await c.admin.query<{ tablename: string }>(`select tablename from pg_tables where schemaname = 'public' and not rowsecurity`);
    expect(rows).toEqual([]);
  });
});

describe('birthdays', () => {
  it('everyone reads them, each adult sets only their own, and impossible dates are refused', async () => {
    await h.breeze.exec(`insert into public.member_birthdays (member_id, month, day) values ('adult3', 8, 2)`);
    expect(await h.jay.query('select member_id, month, day from public.member_birthdays')).toEqual([{ member_id: 'adult3', month: 8, day: 2 }]);
    await expect(h.breeze.exec(`insert into public.member_birthdays (member_id, month, day) values ('jay', 3, 27)`)).rejects.toThrow(/row-level security/i);
    await expect(h.jay.exec(`update public.member_birthdays set month = 1 where member_id = 'adult3'`)).resolves.toBeUndefined();
    expect(await h.breeze.query('select month from public.member_birthdays')).toEqual([{ month: 8 }]); // Jay's update touched nothing
    await expect(h.jay.exec(`insert into public.member_birthdays (member_id, month, day) values ('jay', 2, 30)`)).rejects.toThrow(/check/i);
    await expect(h.anon.query('select * from public.member_birthdays')).rejects.toThrow(/permission denied/i);
  });
});
