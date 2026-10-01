import { buildSeed } from './seed';
import {
  type DemoState,
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
import type { HouseholdSnapshot, MemberId } from './types';
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
}

const KEY = 'cottage.demo.v1';

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
    /* storage unavailable (private mode): the demo just won't persist */
  }
}

const update = (fn: (s: DemoState) => DemoState) => save(fn(load()));

export const localDemoRepository: HouseholdRepository = {
  getSnapshot: (now) => applyDemoState(buildSeed(now), load()),
  claimCoverage: (id, by) => update((s) => claimCoverage(s, id, by)),
  confirmEvent: (id) => update((s) => confirmEvent(s, id)),
  completeTask: (id, by, now) => update((s) => completeTask(s, id, by, toLocal(now))),
  releaseCoverage: (id) => update((s) => releaseCoverage(s, id)),
  unconfirmEvent: (id) => update((s) => unconfirmEvent(s, id)),
  reopenTask: (id) => update((s) => reopenTask(s, id)),
  markMailChecked: (by, now) => update((s) => setMail(s, { checkedBy: by, checkedAt: toLocal(now) })),
  resetMailCheck: () => update((s) => setMail(s, undefined)),
};
