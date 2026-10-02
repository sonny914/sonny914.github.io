import { buildSeed } from './seed';
import {
  type DemoState,
  EMPTY_DEMO_STATE,
  applyDemoState,
  claimCoverage,
  clearContact,
  completeSetup,
  completeTask,
  confirmEvent,
  deleteChildUpdate,
  deleteUnavailable,
  deleteWorkEntry,
  releaseCoverage,
  reopenTask,
  saveChildUpdate,
  saveContact,
  saveUnavailable,
  saveWorkEntry,
  setMail,
  unconfirmEvent,
} from './demoState';
import { StorageError } from './errors';
import type {
  ChildUpdate,
  HouseholdSnapshot,
  MemberId,
  SetupStatus,
  TrustedContact,
  UnavailablePeriod,
  WorkEntry,
} from './types';
import { toLocal } from '../lib/dates';
import { normalizeWorkEntry } from '../lib/schedules';

export { SaveError, StorageError } from './errors';

/**
 * The seam between the UI and wherever household data lives.
 *
 * - 'demo': seed data plus an overlay saved in this browser (localStorage). Single device.
 * - 'shared': the household's Supabase project. Every adult sees the same data.
 *
 * Every write returns a promise that REJECTS with a SaveError if the change was not stored, so a
 * caller can never report "saved" for a lost change. Attribution (who created / last edited) is the
 * authenticated account in shared mode; the `by` arguments are only used by the demo.
 */
export interface HouseholdRepository {
  readonly mode: 'demo' | 'shared';
  /** An immediate answer when the data is local (demo), so the first paint is never empty. */
  loadNow?(now: Date): HouseholdSnapshot;
  load(now: Date): Promise<HouseholdSnapshot>;

  claimCoverage(requestId: string, by: MemberId): Promise<void>;
  confirmEvent(eventId: string): Promise<void>;
  completeTask(taskId: string, by: MemberId, now: Date): Promise<void>;
  releaseCoverage(requestId: string): Promise<void>;
  unconfirmEvent(eventId: string): Promise<void>;
  reopenTask(taskId: string): Promise<void>;
  markMailChecked(by: MemberId, now: Date): Promise<void>;
  /** Takes back the latest mail check (demo: restores the previous state). */
  resetMailCheck(): Promise<void>;

  saveWorkEntry(entry: WorkEntry): Promise<void>;
  deleteWorkEntry(id: string): Promise<void>;
  saveUnavailable(period: UnavailablePeriod): Promise<void>;
  deleteUnavailable(id: string): Promise<void>;
  saveChildUpdate(update: ChildUpdate): Promise<void>;
  deleteChildUpdate(id: string): Promise<void>;
  saveContact(id: string, patch: Partial<TrustedContact>, by: MemberId, now: Date): Promise<void>;
  completeSetup(memberId: MemberId, status: SetupStatus): Promise<void>;
}

// ---- Demo implementation (this browser only) -----------------------------------

const KEY = 'cottage.demo.v1';

/** Records saved in this browser by the demo. Read-only for the import review; never uploaded silently. */
export function readLocalDemoState(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_DEMO_STATE;
    const s = { ...EMPTY_DEMO_STATE, ...(JSON.parse(raw) as Partial<DemoState>) };
    return { ...s, workEntries: s.workEntries.map(normalizeWorkEntry) };
  } catch {
    return EMPTY_DEMO_STATE;
  }
}

/** Removes specific demo records from this browser (only after an explicit confirmation). */
export function removeLocalDemoRecords(keys: string[]): void {
  let s = readLocalDemoState();
  for (const k of keys) {
    const [kind, id = ''] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
    if (kind === 'work') s = deleteWorkEntry(s, id);
    if (kind === 'away') s = deleteUnavailable(s, id);
    if (kind === 'update') s = deleteChildUpdate(s, id);
    if (kind === 'contact') s = clearContact(s, id);
  }
  save(s);
}

function save(s: DemoState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new StorageError();
  }
}

const update = (fn: (s: DemoState) => DemoState) => save(fn(readLocalDemoState()));

export const localDemoRepository: HouseholdRepository = {
  mode: 'demo',
  loadNow: (now) => applyDemoState(buildSeed(now), readLocalDemoState(), now),
  load: async (now) => applyDemoState(buildSeed(now), readLocalDemoState(), now),
  claimCoverage: async (id, by) => update((s) => claimCoverage(s, id, by)),
  confirmEvent: async (id) => update((s) => confirmEvent(s, id)),
  completeTask: async (id, by, now) => update((s) => completeTask(s, id, by, toLocal(now))),
  releaseCoverage: async (id) => update((s) => releaseCoverage(s, id)),
  unconfirmEvent: async (id) => update((s) => unconfirmEvent(s, id)),
  reopenTask: async (id) => update((s) => reopenTask(s, id)),
  saveWorkEntry: async (e) => update((s) => saveWorkEntry(s, e)),
  deleteWorkEntry: async (id) => update((s) => deleteWorkEntry(s, id)),
  saveUnavailable: async (u) => update((s) => saveUnavailable(s, u)),
  deleteUnavailable: async (id) => update((s) => deleteUnavailable(s, id)),
  saveChildUpdate: async (u) => update((s) => saveChildUpdate(s, u)),
  deleteChildUpdate: async (id) => update((s) => deleteChildUpdate(s, id)),
  saveContact: async (id, patch, by, now) => update((s) => saveContact(s, id, { ...patch, updatedBy: by, updatedAt: toLocal(now) })),
  completeSetup: async (id, status) => update((s) => completeSetup(s, id, status)),
  markMailChecked: async (by, now) => update((s) => setMail(s, { checkedBy: by, checkedAt: toLocal(now) })),
  resetMailCheck: async () => update((s) => setMail(s, undefined)),
};
