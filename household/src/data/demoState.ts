import type {
  ChildUpdate,
  HouseholdEvent,
  HouseholdSnapshot,
  LocalDateTime,
  MemberBirthday,
  MailCheck,
  MemberId,
  SetupStatus,
  TrustedContact,
  UnavailablePeriod,
  WorkEntry,
} from './types';
import { addDays, startOfDay } from '../lib/dates';
import { DEFAULT_BIRTHDAYS, mergeBirthdays } from '../lib/routines';
import { expandWorkEntry, normalizeWorkEntry, updateToEvent } from '../lib/schedules';

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
  workEntries: WorkEntry[];
  unavailable: UnavailablePeriod[];
  childUpdates: ChildUpdate[];
  /** Contact details entered by adults, keyed by contact id. */
  contacts: Record<string, Partial<TrustedContact>>;
  setup: Record<MemberId, SetupStatus>;
  /** Birthdays adults entered, by member. */
  birthdays: Record<MemberId, { month: number; day: number }>;
}

export const EMPTY_DEMO_STATE: DemoState = {
  coverage: {},
  confirmed: [],
  tasksDone: {},
  workEntries: [],
  unavailable: [],
  childUpdates: [],
  contacts: {},
  setup: {},
  birthdays: {},
};

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];
}

export const saveWorkEntry = (s: DemoState, e: WorkEntry): DemoState => ({ ...s, workEntries: upsert(s.workEntries, e) });
export const deleteWorkEntry = (s: DemoState, id: string): DemoState => ({ ...s, workEntries: s.workEntries.filter((x) => x.id !== id) });
export const saveUnavailable = (s: DemoState, u: UnavailablePeriod): DemoState => ({ ...s, unavailable: upsert(s.unavailable, u) });
export const deleteUnavailable = (s: DemoState, id: string): DemoState => ({ ...s, unavailable: s.unavailable.filter((x) => x.id !== id) });
export const saveChildUpdate = (s: DemoState, u: ChildUpdate): DemoState => ({ ...s, childUpdates: upsert(s.childUpdates, u) });
export const deleteChildUpdate = (s: DemoState, id: string): DemoState => ({ ...s, childUpdates: s.childUpdates.filter((x) => x.id !== id) });
export const saveContact = (s: DemoState, id: string, patch: Partial<TrustedContact>): DemoState => ({ ...s, contacts: { ...s.contacts, [id]: { ...s.contacts[id], ...patch } } });
export const clearContact = (s: DemoState, id: string): DemoState => {
  const { [id]: _gone, ...rest } = s.contacts;
  return { ...s, contacts: rest };
};
export const completeSetup = (s: DemoState, id: MemberId, status: SetupStatus): DemoState => ({ ...s, setup: { ...s.setup, [id]: status } });

export const saveBirthday = (s: DemoState, id: MemberId, month: number, day: number): DemoState => ({ ...s, birthdays: { ...s.birthdays, [id]: { month, day } } });

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

/**
 * Layers the demo changes over a snapshot without mutating either.
 * Derived events (from work entries and dated child updates) are rebuilt here on
 * every read and keyed by id, so an edit replaces the event and never copies it.
 */
export function applyDemoState(seed: HouseholdSnapshot, s: DemoState, now: Date = new Date()): HouseholdSnapshot {
  const adults = new Set(seed.members.filter((m) => m.role === 'adult').map((m) => m.id));
  const from = addDays(startOfDay(now), -7);
  const to = addDays(startOfDay(now), 60);

  // An adult who has entered their own schedule replaces the sample shifts for that person.
  const workEntries = s.workEntries.map(normalizeWorkEntry);
  const ownSchedule = new Set(workEntries.map((e) => e.memberId));
  const base = seed.events.filter(
    (e) => !(e.category === 'work' && e.sourceScheduleId && e.participantIds.some((id) => ownSchedule.has(id))),
  );

  const derived: HouseholdEvent[] = [
    ...workEntries.flatMap((e) => expandWorkEntry(e, from, to)),
    ...s.childUpdates.map(updateToEvent).filter((e): e is HouseholdEvent => !!e),
  ];
  const events = [...new Map([...base, ...derived].map((e) => [e.id, e])).values()];

  return {
    ...seed,
    mailCheck: s.mail ?? seed.mailCheck,
    // Only adults can cover. A trusted contact is never an assignee, so a claim naming one is ignored.
    coverageRequests: seed.coverageRequests.map((c) => {
      const by = s.coverage[c.id];
      return by && adults.has(by) ? { ...c, status: 'claimed', claimedBy: by } : c;
    }),
    events: events.map((e) =>
      s.confirmed.includes(e.id) ? { ...e, confirmation: { ...e.confirmation, state: 'confirmed' } } : e,
    ),
    reminders: seed.reminders.map((r) => {
      const done = s.tasksDone[r.id];
      return done ? { ...r, completedAt: done.at, completedBy: done.by } : r;
    }),
    workEntries,
    unavailable: s.unavailable,
    childUpdates: s.childUpdates,
    trustedContacts: seed.trustedContacts.map((c) => ({ ...c, ...s.contacts[c.id] })),
    setup: s.setup,
    birthdays: mergeBirthdays(
      DEFAULT_BIRTHDAYS,
      Object.entries(s.birthdays).map(([memberId, b]): MemberBirthday => ({ memberId, ...b })),
    ),
  };
}
