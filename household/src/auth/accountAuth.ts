import type { DbClient } from '../data/db';
import type { AuthResult, AuthService } from './auth';

/** The slice of `supabase.auth` the app uses. */
export interface AuthApi {
  getSession(): Promise<{ data: { session: { user: { email?: string | null } } | null }; error: unknown }>;
  onAuthStateChange(cb: () => void): { data: { subscription: { unsubscribe(): void } } };
  signInWithOtp(args: { email: string; options: { shouldCreateUser: boolean; emailRedirectTo?: string } }): Promise<{ error: { message: string; status?: number } | null }>;
  verifyOtp(args: { email: string; token: string; type: 'email' }): Promise<{ error: { message: string } | null }>;
  signOut(): Promise<{ error: unknown }>;
}

/**
 * Real accounts. Sign-in is by e-mail link or 6-digit code, for addresses that already exist
 * (shouldCreateUser is false, so this app never creates accounts). Who the person is comes from the
 * `account_links` row, which only the database can write and which row-level security lets you read
 * only for yourself.
 */
export function createAccountAuth(client: DbClient, auth: AuthApi, redirectTo?: string): AuthService {
  return {
    kind: 'account',

    async getSession(): Promise<AuthResult> {
      const { data, error } = await auth.getSession();
      if (error) throw new Error('Couldn’t check sign-in.');
      const user = data.session?.user;
      if (!user) return { status: 'signed-out' };
      const { data: link, error: linkError } = await client.from('account_links').select('member_id').maybeSingle();
      if (linkError) throw new Error('Couldn’t check which household member this account is.');
      const memberId = (link as { member_id?: string } | null)?.member_id;
      return memberId ? { status: 'signed-in', session: { memberId, email: user.email ?? undefined } } : { status: 'unlinked', email: user.email ?? undefined };
    },

    subscribe(onChange) {
      const { data } = auth.onAuthStateChange(onChange);
      return () => data.subscription.unsubscribe();
    },

    async requestSignIn(email) {
      const { error } = await auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false, emailRedirectTo: redirectTo } });
      // A rejected address (not invited) answers like an accepted one, so the form never reveals who is invited.
      // Only a server or network failure is reported.
      if (error && (error.status === undefined || error.status >= 500)) throw new Error('Couldn’t send the sign-in e-mail. Check your connection and try again.');
    },

    async verifyCode(email, code) {
      const { error } = await auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) throw new Error('That code didn’t work. Check it and try again, or request a new one.');
    },

    async signOut() {
      await auth.signOut();
    },
  };
}
