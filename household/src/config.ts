/**
 * Where the app gets its data. With no Supabase settings it runs as a single-device demo.
 * With both settings it runs against the household's Supabase project.
 *
 * Only PUBLIC values belong in the browser: the project URL and the anon / publishable key.
 * A service-role or secret key must never be put here, so one is refused outright.
 */
export type AppConfig =
  | { mode: 'demo' }
  | { mode: 'shared'; url: string; anonKey: string }
  | { mode: 'invalid'; reason: string };

type Env = Record<string, string | undefined>;

/** Reads the role claim from a JWT without verifying it. Only used to refuse a privileged key. */
function jwtRole(token: string): string | undefined {
  const part = token.split('.')[1];
  if (!part) return undefined;
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
    return (JSON.parse(json) as { role?: string }).role;
  } catch {
    return undefined;
  }
}

export function isPrivilegedKey(key: string): boolean {
  return key.startsWith('sb_secret_') || jwtRole(key) === 'service_role';
}

export function readConfig(env: Env): AppConfig {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url && !anonKey) return { mode: 'demo' };
  if (!url || !anonKey) {
    return { mode: 'invalid', reason: 'Set both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or neither to run the demo.' };
  }
  if (isPrivilegedKey(anonKey)) {
    return { mode: 'invalid', reason: 'VITE_SUPABASE_ANON_KEY is a privileged (service / secret) key. Browser code may only use the anon or publishable key.' };
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') throw new Error('not https');
  } catch {
    return { mode: 'invalid', reason: 'VITE_SUPABASE_URL must be an https:// project URL.' };
  }
  return { mode: 'shared', url, anonKey };
}
