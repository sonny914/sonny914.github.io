import type { MemberId } from '../data/types';

export interface AuthSession {
  memberId: MemberId;
}

/**
 * Who is using the app. Two implementations are possible:
 *
 * - 'demo' (the only one built): choosing a name stores it in this browser. There is
 *   no password and no proof of identity, so it is NOT a sign-in and nothing is shared.
 * - 'account' (needs external setup, see README): real sign-in by e-mail link. The
 *   signed-in account is linked once to one member id (jay / fallon / adult3), and
 *   getSession() returns that member. Member ids never change.
 */
export interface AuthService {
  readonly kind: 'demo' | 'account';
  getSession(adultIds: MemberId[]): AuthSession | null;
  /** Demo: remember this choice. Account: link the signed-in account to this member. */
  chooseProfile(memberId: MemberId): void;
  /** Demo: forget the choice ("Switch person"). Account: sign out. */
  signOut(): void;
}

// Same key slice 1 used for "Viewing as", so an earlier choice carries over.
const KEY = 'cottage.demo.viewingAs.v1';

export const demoAuth: AuthService = {
  kind: 'demo',
  getSession(adultIds) {
    try {
      const stored = window.localStorage.getItem(KEY);
      return stored && adultIds.includes(stored) ? { memberId: stored } : null;
    } catch {
      return null;
    }
  },
  chooseProfile(memberId) {
    try {
      window.localStorage.setItem(KEY, memberId);
    } catch {
      /* private mode: the choice just will not persist */
    }
  },
  signOut() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
