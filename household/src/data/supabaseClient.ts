import { createClient } from '@supabase/supabase-js';
import { createAccountAuth, type AuthApi } from '../auth/accountAuth';
import type { AuthService } from '../auth/auth';
import type { DbClient } from './db';

/** Browser client for the household's project. Uses ONLY the public anon / publishable key. */
export function createBrowserServices(url: string, anonKey: string): { db: DbClient; auth: AuthService } {
  const client = createClient(url, anonKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  const db = client as unknown as DbClient;
  const authApi = client.auth as unknown as AuthApi;
  return { db, auth: createAccountAuth(db, authApi, window.location.origin) };
}
