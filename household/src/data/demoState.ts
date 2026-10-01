import type { HouseholdSnapshot, LocalDateTime, MailCheck, MemberId } from './types';

/**
 * What a person has changed on top of the seed data in this demo.
 * Pure data plus pure functions, so the repository only has to persist it and
 * a real database can later replace both.
 */
export interface DemoState {
  mail?: MailCheck;
  /** coverage request id -> adult who said "I'll cover". */
  coverage: Record<string, MemberId>;
  /** event ids that have been confirmed. */
  confirmed: string[];
  /** reminder/task id -> who finished it and when. */
  tasksDone: Record<string, { by: MemberId; at: LocalDateTime }>;
}

export const EMPTY_DEMO_STATE: DemoState = { coverage: {}, confirmed: [], tasksDone: {} };

export function claimCoverage(s: DemoState, id: string, by: MemberId): DemoState {
  return { ...s, coverage: { ...s.coverage, [id]: by } };
}

export function confirmEvent(s: DemoState, id: string): DemoState {
  return s.confirmed.includes(id) ? s : { ...s, confirmed: [...s.confirmed, id] };
}

export function releaseCoverage(s: DemoState, id: string): DemoState {
  const { [id]: _released, ...rest } = s.coverage;
  return { ...s, coverage: rest };
}

export function unconfirmEvent(s: DemoState, id: string): DemoState {
  return { ...s, confirmed: s.confirmed.filter((x) => x !== id) };
}

export function reopenTask(s: DemoState, id: string): DemoState {
  const { [id]: _reopened, ...rest } = s.tasksDone;
  return { ...s, tasksDone: rest };
}

export function completeTask(s: DemoState, id: string, by: MemberId, at: LocalDateTime): DemoState {
  return { ...s, tasksDone: { ...s.tasksDone, [id]: { by, at } } };
}

export function setMail(s: DemoState, mail: MailCheck | undefined): DemoState {
  const { mail: _old, ...rest } = s;
  return mail ? { ...rest, mail } : rest;
}

/** Layers the demo changes over a snapshot without mutating either. */
export function applyDemoState(seed: HouseholdSnapshot, s: DemoState): HouseholdSnapshot {
  return {
    ...seed,
    mailCheck: s.mail ?? seed.mailCheck,
    coverageRequests: seed.coverageRequests.map((c) =>
      s.coverage[c.id] ? { ...c, status: 'claimed', claimedBy: s.coverage[c.id] } : c,
    ),
    events: seed.events.map((e) =>
      s.confirmed.includes(e.id) ? { ...e, confirmation: { ...e.confirmation, state: 'confirmed' } } : e,
    ),
    reminders: seed.reminders.map((r) => {
      const done = s.tasksDone[r.id];
      return done ? { ...r, completedAt: done.at, completedBy: done.by } : r;
    }),
  };
}
