import { buildSeed } from './seed';
import {
  type DemoState,
  completeSetup,
  deleteChildUpdate,
  deleteUnavailable,
  deleteWorkEntry,
  saveChildUpdate,
  saveContact,
  saveUnavailable,
  saveWorkEntry,
  EMPTY_DEMO_STATE,
  applyDemoState,
  claimCoverage,
  completeTask,
  confirmEvent,
  releaseCoverage,
  reopenTask,
  setMail,
  unconfirmEvent,
} from './demoState';
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

/**
 * The seam between the UI and wherever household data lives.
 * Slice 1 implements it with seed data plus a small localStorage overlay of
 * what people changed. A database-backed version replaces this file (and will
 * make the methods async); components only see the interface.
 */
export interface HouseholdRepository {
  getSnapshot(now: Date): HouseholdSnapshot;
  claimCoverage(requestId: string, by: MemberId): void;
  confirmEvent(eventId: string): void;
  completeTask(taskId: string, by: MemberId, now: Date): void;
  releaseCoverage(requestId: string): void;
  unconfirmEvent(eventId: string): void;
  reopenTask(taskId: string): void;
  markMailChecked(by: MemberId, now: Date): void;
  /** Restores the previous mail state (demo "Undo"). */
  resetMailCheck(): void;

  // Every write below throws StorageError if it could not be stored, so callers never report
  // "Saved" for a change that was lost.
  // Each save stamps createdBy/updatedBy. In a shared database the same calls become writes
  // that every adult's device sees; here they are saved on this device only.
  saveWorkEntry(entry: WorkEntry): void;
  deleteWorkEntry(id: string): void;
  saveUnavailable(period: UnavailablePeriod): void;
  deleteUnavailable(id: string): void;
  saveChildUpdate(update: ChildUpdate): void;
  deleteChildUpdate(id: string): void;
  saveContact(id: string, patch: Partial<TrustedContact>, by: MemberId, now: Date): void;
  completeSetup(memberId: MemberId, status: SetupStatus): void;
}

const KEY = 'cottage.demo.v1';

/** Thrown when a change could not be written. Nothing was saved. */
export class StorageError extends Error {
  constructor(message = 'Couldn’t save. Storage on this device is unavailable or full, so your change was not saved.') {
    super(message);
    this.name = 'StorageError';
  }
}

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY_DEMO_STATE, ...(JSON.parse(raw) as Partial<DemoState>) } : EMPTY_DEMO_STATE;
  } catch {
    return EMPTY_DEMO_STATE;
  }
}

function save(s: DemoState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new StorageError();
  }
}

const update = (fn: (s: DemoState) => DemoState) => save(fn(load()));

export const localDemoRepository: HouseholdRepository = {
  getSnapshot: (now) => applyDemoState(buildSeed(now), load(), now),
  claimCoverage: (id, by) => update((s) => claimCoverage(s, id, by)),
  confirmEvent: (id) => update((s) => confirmEvent(s, id)),
  completeTask: (id, by, now) => update((s) => completeTask(s, id, by, toLocal(now))),
  releaseCoverage: (id) => update((s) => releaseCoverage(s, id)),
  unconfirmEvent: (id) => update((s) => unconfirmEvent(s, id)),
  reopenTask: (id) => update((s) => reopenTask(s, id)),
  saveWorkEntry: (e) => update((s) => saveWorkEntry(s, e)),
  deleteWorkEntry: (id) => update((s) => deleteWorkEntry(s, id)),
  saveUnavailable: (u) => update((s) => saveUnavailable(s, u)),
  deleteUnavailable: (id) => update((s) => deleteUnavailable(s, id)),
  saveChildUpdate: (u) => update((s) => saveChildUpdate(s, u)),
  deleteChildUpdate: (id) => update((s) => deleteChildUpdate(s, id)),
  saveContact: (id, patch, by, now) => update((s) => saveContact(s, id, { ...patch, updatedBy: by, updatedAt: toLocal(now) })),
  completeSetup: (id, status) => update((s) => completeSetup(s, id, status)),
  markMailChecked: (by, now) => update((s) => setMail(s, { checkedBy: by, checkedAt: toLocal(now) })),
  resetMailCheck: () => update((s) => setMail(s, undefined)),
};
