import { beforeEach, describe, expect, it } from 'vitest';
import { createHousehold } from '../db/testDb';
import { pgliteDbClient } from '../db/pgliteClient';
import { SaveError } from './errors';
import { createSupabaseRepository } from './supabaseRepository';
import type { ChildUpdate, UnavailablePeriod, WorkEntry } from './types';

type H = Awaited<ReturnType<typeof createHousehold>>;
let h: H;
const now = new Date(2026, 9, 1, 14, 0);
beforeEach(async () => {
  h = await createHousehold();
}, 60_000);

const repoFor = (who: 'jay' | 'fallon' | 'breeze') => createSupabaseRepository(pgliteDbClient(h[who]));
// The browser never chooses attribution, so what we send here is deliberately wrong to prove it is ignored.
const forged = { createdBy: 'fallon', createdAt: '2001-01-01T00:00', updatedBy: 'fallon', updatedAt: '2001-01-01T00:00' };

const shift = (over: Partial<WorkEntry> = {}): WorkEntry => ({
  id: 'wk-jay-1', memberId: 'jay', date: '2026-10-02', start: '22:00', endDate: '2026-10-03', end: '06:00',
  repeat: { weekdays: [5] }, ...forged, ...over,
});
const twin = (over: Partial<ChildUpdate> = {}): ChildUpdate => ({
  id: 'cu-1', childIds: ['khodi', 'kenzli'], type: 'appointment', title: 'Dentist', note: 'Bring the card', at: '2026-10-06T09:00', ...forged, ...over,
});

describe('a new shared household', () => {
  it('starts empty: no sample events, Fran with no details, no mail logged, nothing set up', async () => {
    const s = await repoFor('jay').load(now);
    expect(s.events).toEqual([]);
    expect(s.workEntries).toEqual([]);
    expect(s.childUpdates).toEqual([]);
    expect(s.coverageRequests).toEqual([]);
    expect(s.mailCheck).toBeNull();
    expect(s.setup).toEqual({});
    expect(s.trustedContacts).toHaveLength(1);
    expect(s.trustedContacts[0]).toMatchObject({ id: 'fran', name: 'Fran', role: 'Preferred backup nanny' });
    expect(s.trustedContacts[0]!.phone).toBeUndefined();
    expect(s.trustedContacts[0]!.email).toBeUndefined();
    expect(s.members.map((m) => m.id)).toEqual(['jay', 'fallon', 'adult3', 'khodi', 'kenzli']);
  });
});

describe('work schedules across two signed-in sessions', () => {
  it('Jay saves an overnight weekly shift; Fallon sees it, attributed to Jay, and Home gets the occurrences', async () => {
    await repoFor('jay').saveWorkEntry(shift());
    const seen = await repoFor('fallon').load(now);
    expect(seen.workEntries).toHaveLength(1);
    expect(seen.workEntries[0]).toMatchObject({ memberId: 'jay', date: '2026-10-02', endDate: '2026-10-03', start: '22:00', end: '06:00', createdBy: 'jay', updatedBy: 'jay' });
    expect(seen.workEntries[0]!.createdAt).not.toMatch(/^2001/);
    const first = seen.events.find((e) => e.origin?.id === 'wk-jay-1');
    expect(first).toMatchObject({ start: '2026-10-02T22:00', end: '2026-10-03T06:00', participantIds: ['jay'] });
  });

  it('an edit by the owner updates the same series without duplicating it', async () => {
    const jay = repoFor('jay');
    await jay.saveWorkEntry(shift());
    await jay.saveWorkEntry(shift({ end: '05:00' }));
    const s = await repoFor('breeze').load(now);
    expect(s.workEntries).toHaveLength(1);
    expect(s.workEntries[0]!.end).toBe('05:00');
    const ids = s.events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Fallon cannot create, take over, edit or delete Jay\'s schedule, and is told why', async () => {
    await repoFor('jay').saveWorkEntry(shift());
    const fallon = repoFor('fallon');
    await expect(fallon.saveWorkEntry(shift({ id: 'wk-fake' }))).rejects.toThrow(SaveError);
    await expect(fallon.saveWorkEntry(shift({ id: 'wk-fake' }))).rejects.toThrow(/permission/i);
    await expect(fallon.saveWorkEntry(shift({ memberId: 'fallon', end: '23:00' }))).rejects.toThrow(/permission|couldn.t save/i); // same id, trying to take it
    await expect(fallon.deleteWorkEntry('wk-jay-1')).rejects.toThrow(/isn.t yours/i);
    const s = await repoFor('jay').load(now);
    expect(s.workEntries).toHaveLength(1);
    expect(s.workEntries[0]).toMatchObject({ memberId: 'jay', end: '06:00' });
  });

  it('lets the owner delete their own shift, and unavailable times follow the same rules', async () => {
    const jay = repoFor('jay');
    await jay.saveWorkEntry(shift());
    await jay.deleteWorkEntry('wk-jay-1');
    expect((await jay.load(now)).workEntries).toEqual([]);

    const away: UnavailablePeriod = { id: 'un-1', memberId: 'adult3', start: '2026-10-08T00:00', end: '2026-10-08T00:00', allDay: true, note: 'Trip', ...forged };
    await repoFor('breeze').saveUnavailable(away);
    expect((await repoFor('jay').load(now)).unavailable[0]).toMatchObject({ id: 'un-1', memberId: 'adult3', allDay: true, note: 'Trip', createdBy: 'adult3' });
    await expect(repoFor('jay').deleteUnavailable('un-1')).rejects.toThrow(/isn.t yours/i);
    await expect(repoFor('jay').saveUnavailable({ ...away, id: 'un-2' })).rejects.toThrow(/permission/i);
  });
});

describe('child updates across two signed-in sessions', () => {
  it('one update for both twins is one shared record that every adult sees, with one derived event', async () => {
    await repoFor('breeze').saveChildUpdate(twin());
    for (const who of ['jay', 'fallon', 'breeze'] as const) {
      const s = await repoFor(who).load(now);
      expect(s.childUpdates).toHaveLength(1);
      expect(s.childUpdates[0]).toMatchObject({ id: 'cu-1', childIds: ['kenzli', 'khodi'], title: 'Dentist', createdBy: 'adult3', updatedBy: 'adult3' });
      expect(s.events.filter((e) => e.origin?.id === 'cu-1')).toHaveLength(1);
    }
  });

  it('another adult can edit it for either child; the creator is kept and the editor is recorded from the account', async () => {
    await repoFor('breeze').saveChildUpdate(twin());
    await repoFor('fallon').saveChildUpdate(twin({ title: 'Dentist (moved)', childIds: ['khodi'], at: '2026-10-07T10:00' }));
    const s = await repoFor('jay').load(now);
    expect(s.childUpdates).toHaveLength(1);
    expect(s.childUpdates[0]).toMatchObject({ title: 'Dentist (moved)', childIds: ['khodi'], createdBy: 'adult3', updatedBy: 'fallon' });
    expect(s.events.filter((e) => e.origin?.id === 'cu-1')).toHaveLength(1);
    expect(s.events.find((e) => e.origin?.id === 'cu-1')).toMatchObject({ start: '2026-10-07T10:00', participantIds: ['khodi'] });
  });

  it('any adult can delete one, removing the event too', async () => {
    await repoFor('jay').saveChildUpdate(twin());
    await repoFor('breeze').deleteChildUpdate('cu-1');
    const s = await repoFor('fallon').load(now);
    expect(s.childUpdates).toEqual([]);
    expect(s.events).toEqual([]);
  });

  it('refuses an update with no child, and says so', async () => {
    await expect(repoFor('jay').saveChildUpdate(twin({ childIds: [] }))).rejects.toThrow(/at least one child/i);
    expect((await repoFor('jay').load(now)).childUpdates).toEqual([]);
  });
});

describe('Fran, setup and mail across sessions', () => {
  it('Fran\'s details are shared, start empty, and carry who entered them', async () => {
    await repoFor('breeze').saveContact('fran', { phone: '555-0142', notes: 'Prefers text' }, 'adult3', now);
    const s = await repoFor('jay').load(now);
    expect(s.trustedContacts[0]).toMatchObject({ phone: '555-0142', notes: 'Prefers text', updatedBy: 'adult3' });
    expect(s.trustedContacts[0]!.email).toBeUndefined();
    await repoFor('fallon').saveContact('fran', {}, 'fallon', now); // clearing is allowed
    expect((await repoFor('jay').load(now)).trustedContacts[0]!.phone).toBeUndefined();
  });

  it('each adult manages only their own setup flag', async () => {
    await repoFor('jay').completeSetup('jay', 'skipped');
    expect((await repoFor('jay').load(now)).setup).toEqual({ jay: 'skipped' });
    expect((await repoFor('fallon').load(now)).setup).toEqual({});
    await expect(repoFor('jay').completeSetup('fallon', 'done')).rejects.toThrow(/permission/i);
  });

  it('mail checks are shared, cannot be forged, and only the checker can undo', async () => {
    await repoFor('jay').markMailChecked('fallon', now); // lies about who; the database uses the account
    const seen = await repoFor('breeze').load(now);
    expect(seen.mailCheck?.checkedBy).toBe('jay');
    await expect(repoFor('fallon').resetMailCheck()).rejects.toThrow(/only the person who checked/i);
    expect((await repoFor('breeze').load(now)).mailCheck?.checkedBy).toBe('jay');
    await repoFor('jay').resetMailCheck();
    expect((await repoFor('breeze').load(now)).mailCheck).toBeNull();
  });

  it('coverage needs, confirmations and chores are not shared records yet, and say so instead of pretending', async () => {
    const r = repoFor('jay');
    await expect(r.claimCoverage('cov-1', 'jay')).rejects.toThrow(/isn.t available in shared mode/i);
    await expect(r.confirmEvent('e-1')).rejects.toThrow(SaveError);
    await expect(r.completeTask('t-1', 'jay', now)).rejects.toThrow(SaveError);
  });
});

describe('failures are reported, never hidden', () => {
  it('a dropped connection says nothing was saved and the entries are still in the form', async () => {
    const r = createSupabaseRepository(pgliteDbClient(h.jay, { failWith: { message: 'TypeError: Failed to fetch' } }));
    await expect(r.saveWorkEntry(shift())).rejects.toThrow(/couldn.t reach the server, so nothing was saved/i);
    await expect(r.saveChildUpdate(twin())).rejects.toThrow(/still in the form/i);
    await expect(r.load(now)).rejects.toThrow(/couldn.t load/i);
    expect((await repoFor('jay').load(now)).workEntries).toEqual([]);
  });

  it('an expired sign-in says to sign in again', async () => {
    const r = createSupabaseRepository(pgliteDbClient(h.jay, { failWith: { message: 'JWT expired', status: 401 } }));
    await expect(r.saveWorkEntry(shift())).rejects.toThrow(/signed out|sign in again/i);
  });

  it('a signed-in account with no household link can read and change nothing', async () => {
    const ghost = createSupabaseRepository(pgliteDbClient(h.as('00000000-0000-0000-0000-00000000dead')));
    const s = await ghost.load(now);
    expect(s.workEntries).toEqual([]);
    expect(s.trustedContacts).toEqual([]);
    await expect(ghost.saveChildUpdate(twin())).rejects.toThrow(SaveError);
  });
});
