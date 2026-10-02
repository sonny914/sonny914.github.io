import { describe, expect, it } from 'vitest';
import { buildSeed } from './seed';
import {
  EMPTY_DEMO_STATE,
  applyDemoState,
  claimCoverage,
  deleteChildUpdate,
  deleteWorkEntry,
  saveChildUpdate,
  saveContact,
  saveUnavailable,
  saveWorkEntry,
} from './demoState';
import type { ChildUpdate, WorkEntry } from './types';
import { attentionItems, busyAdults, coverageAvailability } from '../lib/schedule';
import { describeWorkEntry, expandWorkEntry, updateToEvent, validateShift } from '../lib/schedules';

// Thursday 1 Oct 2026, 2:00 PM.
const now = new Date(2026, 9, 1, 14, 0);
const seed = buildSeed(now);
const stamp = { createdBy: 'breeze', createdAt: '2026-10-01T09:00', updatedBy: 'breeze', updatedAt: '2026-10-01T09:00' };

const weekly: WorkEntry = { id: 'wk1', memberId: 'adult3', date: '2026-10-02', start: '09:00', end: '17:00', repeat: { weekdays: [1, 3, 5] }, ...stamp };
const once: WorkEntry = { id: 'wk2', memberId: 'adult3', date: '2026-10-03', start: '10:00', end: '14:00', ...stamp };

const twinUpdate: ChildUpdate = { id: 'up1', childIds: ['khodi', 'kenzli'], type: 'appointment', title: 'Dentist', note: 'Bring the card', at: '2026-10-06T09:00', ...stamp };

describe('validateShift', () => {
  const ok = { date: '2026-10-05', start: '08:00', end: '16:00', repeats: false, weekdays: [], until: '' };
  it('accepts a normal shift', () => expect(validateShift(ok)).toBeNull());
  it('rejects missing and backwards times and overnight', () => {
    expect(validateShift({ ...ok, date: '' })).toMatch(/date/i);
    expect(validateShift({ ...ok, end: '' })).toMatch(/start and end/i);
    expect(validateShift({ ...ok, start: '22:00', end: '06:00' })).toMatch(/overnight/i);
  });
  it('requires a day when repeating, and a sensible end date', () => {
    expect(validateShift({ ...ok, repeats: true })).toMatch(/at least one day/i);
    expect(validateShift({ ...ok, repeats: true, weekdays: [1], until: '2026-10-01' })).toMatch(/on or after/i);
  });
});

describe('work entries', () => {
  it('expands a weekly pattern to the right dates only', () => {
    const days = expandWorkEntry(weekly, new Date(2026, 9, 1), new Date(2026, 9, 14)).map((e) => e.start.slice(0, 10));
    expect(days).toEqual(['2026-10-02', '2026-10-05', '2026-10-07', '2026-10-09', '2026-10-12', '2026-10-14']);
  });
  it('stops at the until date', () => {
    const e = { ...weekly, repeat: { weekdays: [1, 3, 5], until: '2026-10-07' } };
    expect(expandWorkEntry(e, new Date(2026, 9, 1), new Date(2026, 9, 31)).length).toBe(3);
  });
  it('shows up in the snapshot, and replaces that adult\'s sample shifts but nobody else\'s', () => {
    const jayHad = seed.events.some((e) => e.category === 'work' && e.participantIds.includes('jay'));
    const withJay = saveWorkEntry(EMPTY_DEMO_STATE, { ...once, id: 'j1', memberId: 'jay', date: '2026-10-01' });
    const snap = applyDemoState(seed, withJay, now);
    expect(jayHad).toBe(true);
    expect(snap.events.filter((e) => e.category === 'work' && e.participantIds.includes('jay') && e.sourceScheduleId)).toEqual([]);
    expect(snap.events.some((e) => e.id === 'w-j1-2026-10-01')).toBe(true);
    expect(snap.events.some((e) => e.category === 'work' && e.participantIds.includes('fallon') && e.sourceScheduleId)).toBe(true);
  });
  it('editing replaces the events instead of duplicating them; deleting removes them', () => {
    let s = saveWorkEntry(EMPTY_DEMO_STATE, weekly);
    const count = (st: typeof s) => applyDemoState(seed, st, now).events.filter((e) => e.origin?.id === 'wk1').length;
    const before = count(s);
    s = saveWorkEntry(s, { ...weekly, start: '08:00', updatedBy: 'jay' });
    expect(count(s)).toBe(before);
    const ids = applyDemoState(seed, s, now).events.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(applyDemoState(seed, s, now).events.find((e) => e.origin?.id === 'wk1')?.start).toContain('T08:00');
    expect(count(deleteWorkEntry(s, 'wk1'))).toBe(0);
  });
  it('describes one-off and weekly entries in plain words', () => {
    expect(describeWorkEntry(once)).toBe('Sat, Oct 3 · 10:00 AM to 2:00 PM');
    expect(describeWorkEntry(weekly)).toBe('Every Mon, Wed, Fri · 9:00 AM to 5:00 PM');
  });
});

describe('unavailable periods', () => {
  it('count as busy when working out who can cover', () => {
    const adults = ['jay', 'fallon', 'adult3'];
    const inservice = attentionItems(seed, now, 'all').find((i) => i.id === 'cov-inservice')!;
    const free = coverageAvailability(inservice.window!, seed.events, adults, 'jay');
    expect(free.others).toEqual(['adult3']);
    const s = saveUnavailable(EMPTY_DEMO_STATE, { id: 'u1', memberId: 'adult3', start: '2026-10-08T00:00', end: '2026-10-08T00:00', allDay: true, note: 'Out of town', ...stamp });
    const busy = busyAdults(inservice.window!, seed.events, adults, applyDemoState(seed, s, now).unavailable);
    expect(busy.adult3).toMatchObject({ kind: 'unavailable', title: 'Out of town' });
    expect(coverageAvailability(inservice.window!, seed.events, adults, 'jay', applyDemoState(seed, s, now).unavailable).others).toEqual([]);
  });
});

describe('child updates', () => {
  it('one shared update for both twins makes exactly one event naming both', () => {
    const s = saveChildUpdate(EMPTY_DEMO_STATE, twinUpdate);
    const events = applyDemoState(seed, s, now).events.filter((e) => e.origin?.id === 'up1');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: 'u-up1', category: 'appointment', participantIds: ['khodi', 'kenzli'], responsibleAdultIds: [] });
  });
  it('editing updates the same event and records who last edited; deleting removes it', () => {
    let s = saveChildUpdate(EMPTY_DEMO_STATE, twinUpdate);
    s = saveChildUpdate(s, { ...twinUpdate, title: 'Dentist (moved)', at: '2026-10-07T10:00', updatedBy: 'jay', updatedAt: '2026-10-02T08:00' });
    const snap = applyDemoState(seed, s, now);
    expect(snap.events.filter((e) => e.origin?.id === 'up1')).toHaveLength(1);
    expect(snap.events.find((e) => e.id === 'u-up1')).toMatchObject({ title: 'Dentist (moved)', start: '2026-10-07T10:00' });
    expect(snap.childUpdates[0]).toMatchObject({ createdBy: 'breeze', updatedBy: 'jay' });
    expect(applyDemoState(seed, deleteChildUpdate(s, 'up1'), now).events.some((e) => e.id === 'u-up1')).toBe(false);
  });
  it('an undated update stays a note and creates no event', () => {
    expect(updateToEvent({ ...twinUpdate, at: undefined })).toBeUndefined();
  });
  it('reminders and notes belong to their author; appointments start unassigned', () => {
    expect(updateToEvent({ ...twinUpdate, type: 'reminder' })?.responsibleAdultIds).toEqual(['breeze']);
    expect(updateToEvent({ ...twinUpdate, type: 'therapy' })?.responsibleAdultIds).toEqual([]);
  });
});

describe('Fran, the trusted contact', () => {
  it('starts with no invented details', () => {
    const fran = seed.trustedContacts.find((c) => c.id === 'fran')!;
    expect(fran).toMatchObject({ name: 'Fran', role: 'Preferred backup nanny' });
    expect(fran.phone).toBeUndefined();
    expect(fran.email).toBeUndefined();
  });
  it('keeps what an adult enters and who entered it', () => {
    const s = saveContact(EMPTY_DEMO_STATE, 'fran', { phone: '555-0100', updatedBy: 'fallon', updatedAt: '2026-10-02T08:00' });
    expect(applyDemoState(seed, s, now).trustedContacts[0]).toMatchObject({ phone: '555-0100', updatedBy: 'fallon' });
  });
  it('can never cover a request: a claim naming her is ignored and the need stays open', () => {
    const snap = applyDemoState(seed, claimCoverage(EMPTY_DEMO_STATE, 'cov-pickup-today', 'fran'), now);
    expect(snap.coverageRequests.find((c) => c.id === 'cov-pickup-today')).toMatchObject({ status: 'open' });
    expect(attentionItems(snap, now, 'all').some((i) => i.id === 'cov-pickup-today')).toBe(true);
  });
  it('is never counted as free or busy when working out who can cover', () => {
    const win = attentionItems(seed, now, 'all').find((i) => i.id === 'cov-pickup-today')!.window!;
    const a = coverageAvailability(win, seed.events, ['jay', 'fallon', 'adult3'], 'jay');
    expect([...a.others, ...(a.viewerBusy ? ['x'] : [])]).not.toContain('fran');
  });
});
