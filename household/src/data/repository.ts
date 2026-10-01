import { buildSeed } from './seed';
import type { HouseholdSnapshot, MailCheck, MemberId } from './types';
import { toLocal } from '../lib/dates';

/**
 * The seam between the UI and wherever household data lives.
 * Slice 1 implements it with in-memory seed data plus localStorage for the few
 * things that visibly change. A database-backed version replaces this file
 * (and will make the methods async); components only see the interface.
 */
export interface HouseholdRepository {
  getSnapshot(now: Date): HouseholdSnapshot;
  markMailChecked(by: MemberId, now: Date): MailCheck;
  /** Restores the previous mail state (demo "Undo"). */
  resetMailCheck(now: Date): MailCheck;
}

const MAIL_KEY = 'cottage.demo.mailCheck.v1';

function readStored<T>(key: string): T | undefined {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key: string, value: unknown | undefined) {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode): demo state just won't persist */
  }
}

export const localDemoRepository: HouseholdRepository = {
  getSnapshot(now) {
    const seed = buildSeed(now);
    const mail = readStored<MailCheck>(MAIL_KEY);
    return mail ? { ...seed, mailCheck: mail } : seed;
  },
  markMailChecked(by, now) {
    const next: MailCheck = { checkedBy: by, checkedAt: toLocal(now) };
    writeStored(MAIL_KEY, next);
    return next;
  },
  resetMailCheck(now) {
    writeStored(MAIL_KEY, undefined);
    return buildSeed(now).mailCheck;
  },
};
