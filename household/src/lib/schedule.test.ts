import { describe, expect, it } from 'vitest';
import { buildSeed } from '../data/seed';
import { attentionItems, eventStatus, eventsOnDay, mailNeedsCheck, nextUp, upcomingByDay } from './schedule';
import { parseLocal, toLocal } from './dates';

// Thursday 1 Oct 2026, 2:00 PM local.
const now = new Date(2026, 9, 1, 14, 0);
const data = buildSeed(now);

describe('dates', () => {
  it('round-trips local datetime strings', () => {
    expect(toLocal(parseLocal('2026-10-01T15:15'))).toBe('2026-10-01T15:15');
  });
});

describe('today and upcoming', () => {
  it('lists today in time order and nothing from other days', () => {
    const list = eventsOnDay(data.events, now, 'all');
    expect(list.length).toBeGreaterThan(5);
    const starts = list.map((e) => e.start);
    expect([...starts].sort()).toEqual(starts);
    expect(starts.every((s) => s.startsWith('2026-10-01'))).toBe(true);
  });

  it('upcoming covers tomorrow through seven days out, excluding today', () => {
    const groups = upcomingByDay(data.events, now, 'all');
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.day > now)).toBe(true);
    const last = groups[groups.length - 1]!.day;
    expect(last.getDate()).toBe(8);
  });

  it('filters to a member, including events where they are responsible', () => {
    const khodi = eventsOnDay(data.events, now, 'khodi');
    expect(khodi.length).toBeGreaterThan(0);
    expect(khodi.every((e) => e.participantIds.includes('khodi') || e.responsibleAdultIds.includes('khodi'))).toBe(true);
    const adult3 = eventsOnDay(data.events, now, 'adult3').map((e) => e.id);
    expect(adult3).toContain('e-khodi-pickup-0');
  });

  it('classifies event status against the clock', () => {
    const byId = (id: string) => data.events.find((e) => e.id === id)!;
    expect(eventStatus(byId('e-khodi-dropoff-0'), now)).toBe('done');
    expect(eventStatus(byId('e-khodi-pickup-0'), now)).toBe('later');
    expect(eventStatus(byId('e-jay-shift-0'), now)).toBe('now');
    expect(eventStatus(byId('e-picture-day'), now)).toBe('all-day');
  });
});

describe('needs attention', () => {
  it('surfaces coverage, confirmations and overdue tasks', () => {
    const kinds = new Set(attentionItems(data, now, 'all').map((i) => i.kind));
    expect(kinds).toEqual(new Set(['coverage', 'confirmation', 'overdue']));
  });

  it('puts coverage first, then confirmations, then overdue', () => {
    const kinds = attentionItems(data, now, 'all').map((i) => i.kind);
    const rank = { coverage: 0, confirmation: 1, overdue: 2 } as const;
    expect([...kinds].sort((a, b) => rank[a] - rank[b])).toEqual(kinds);
  });

  it('respects the member filter', () => {
    const kenzli = attentionItems(data, now, 'kenzli');
    expect(kenzli.some((i) => i.kind === 'coverage')).toBe(true);
    expect(kenzli.some((i) => i.kind === 'overdue')).toBe(false);
  });

  it('drops coverage that is already over and tasks that are done', () => {
    const late = new Date(2026, 9, 1, 20, 0);
    expect(attentionItems(data, late, 'all').some((i) => i.id === 'cov-pickup-today')).toBe(false);
    const done = {
      ...data,
      reminders: data.reminders.map((r) => (r.id === 'r-library' ? { ...r, completedAt: toLocal(now) } : r)),
    };
    expect(attentionItems(done, now, 'all').some((i) => i.id === 'r-library')).toBe(false);
  });

  it('is empty when nothing needs anyone', () => {
    const calm = { ...data, coverageRequests: [], reminders: [], events: data.events.filter((e) => e.confirmation.state !== 'pending') };
    expect(attentionItems(calm, now, 'all')).toEqual([]);
  });
});

describe('mail', () => {
  it('needs a check until someone has checked it today', () => {
    expect(mailNeedsCheck(parseLocal(data.mailCheck.checkedAt), now)).toBe(true);
    expect(mailNeedsCheck(new Date(2026, 9, 1, 9, 0), now)).toBe(false);
  });
});

describe('next up', () => {
  it('skips shifts and finished events', () => {
    const next = nextUp(eventsOnDay(data.events, now, 'all'), now);
    expect(next?.event.id).toBe('e-khodi-pickup-0');
    expect(next?.status).toBe('later');
  });

  it('is undefined once the day is over', () => {
    const late = new Date(2026, 9, 1, 23, 0);
    expect(nextUp(eventsOnDay(data.events, late, 'all'), late)).toBeUndefined();
  });
});
