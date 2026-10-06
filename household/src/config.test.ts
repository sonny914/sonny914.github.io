import { describe, expect, it } from 'vitest';
import { isPrivilegedKey, readConfig } from './config';
import { createServices } from './services';

const jwt = (role: string) => `h.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.s`;
const URL = 'https://abcdefgh.supabase.co';

describe('readConfig', () => {
  it('runs the single-device demo with no settings', () => {
    expect(readConfig({})).toEqual({ mode: 'demo' });
  });
  it('runs shared with the project URL and an anon key', () => {
    expect(readConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: jwt('anon') })).toMatchObject({ mode: 'shared', url: URL });
    expect(readConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' })).toMatchObject({ mode: 'shared' });
  });
  it('refuses half a configuration instead of silently falling back to the demo', () => {
    expect(readConfig({ VITE_SUPABASE_URL: URL }).mode).toBe('invalid');
    expect(readConfig({ VITE_SUPABASE_ANON_KEY: jwt('anon') }).mode).toBe('invalid');
  });
  it('refuses a privileged key in browser settings, in either format', () => {
    expect(isPrivilegedKey(jwt('service_role'))).toBe(true);
    expect(isPrivilegedKey('sb_secret_abc')).toBe(true);
    expect(isPrivilegedKey(jwt('anon'))).toBe(false);
    for (const key of [jwt('service_role'), 'sb_secret_abc']) {
      const c = readConfig({ VITE_SUPABASE_URL: URL, VITE_SUPABASE_ANON_KEY: key });
      expect(c.mode).toBe('invalid');
      expect(createServices(c).ok).toBe(false);
    }
  });
  it('refuses a non-https URL', () => {
    expect(readConfig({ VITE_SUPABASE_URL: 'http://abc.supabase.co', VITE_SUPABASE_ANON_KEY: jwt('anon') }).mode).toBe('invalid');
  });
});
