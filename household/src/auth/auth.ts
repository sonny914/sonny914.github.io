import type { MemberId } from '../data/types';

export interface AuthSession {
  memberId: MemberId;
  /** Account mode only. */
  email?: string;
}

export type AuthResult =
  | { status: 'signed-out' }
  /** Signed in with Supabase but not linked to a household member. Treated as having no access. */
  | { status: 'unlinked'; email?: string }
  | { status: 'signed-in'; session: AuthSession };

/**
 * Who is using the app.
 *
 * - 'demo': choosing a name stores it in this browser. No password, no proof of identity, so it is
 *   NOT a sign-in and grants nothing. Only used when no Supabase project is configured.
 * - 'account': real e-mail sign-in. The member id comes ONLY from the database (the account link
 *   written when the invited e-mail address first signed up). A person cannot select an identity.
 */
export interface AuthService {
  readonly kind: 'demo' | 'account';
  /** An immediate answer when it can be known synchronously (demo). */
  getSessionNow?(): AuthResult;
  getSession(): Promise<AuthResult>;
  /** Called when the signed-in state changes (for example when a magic link is opened). */
  subscribe(onChange: () => void): () => void;
  /** Demo only. */
  chooseProfile?(memberId: MemberId): Promise<void>;
  /** Account only: e-mail a sign-in link and code. Resolves the same way whether or not the address is invited. */
  requestSignIn?(email: string): Promise<void>;
  /** Account only: sign in with the 6-digit code from the e-mail. */
  verifyCode?(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;
}

// ---- Demo --------------------------------------------------------------------------

// Same key slice 1 used for "Viewing as", so an earlier choice carries over.
const KEY = 'cottage.demo.viewingAs.v1';

export function createDemoAuth(adultIds: MemberId[]): AuthService {
  const read = (): AuthResult => {
    try {
      const stored = window.localStorage.getItem(KEY);
      return stored && adultIds.includes(stored) ? { status: 'signed-in', session: { memberId: stored } } : { status: 'signed-out' };
    } catch {
      return { status: 'signed-out' };
    }
  };
  return {
    kind: 'demo',
    getSessionNow: read,
    getSession: async () => read(),
    subscribe: () => () => undefined,
    async chooseProfile(memberId) {
      try {
        window.localStorage.setItem(KEY, memberId);
      } catch {
        /* private mode: the choice just will not persist */
      }
    },
    async signOut() {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
    },
  };
}
