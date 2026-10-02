import { type AuthService, createDemoAuth } from './auth/auth';
import { type AppConfig, readConfig } from './config';
import { createBrowserServices } from './data/supabaseClient';
import { createSupabaseRepository } from './data/supabaseRepository';
import { type HouseholdRepository, localDemoRepository } from './data/repository';
import { MEMBERS } from './data/members';

export interface Services {
  repo: HouseholdRepository;
  auth: AuthService;
}

export type ServicesResult = { ok: true; services: Services } | { ok: false; reason: string };

/** Chooses demo or shared mode from the build's public settings. Never reads a privileged key. */
export function createServices(config: AppConfig): ServicesResult {
  if (config.mode === 'invalid') return { ok: false, reason: config.reason };
  if (config.mode === 'demo') {
    const adults = MEMBERS.filter((m) => m.role === 'adult').map((m) => m.id);
    return { ok: true, services: { repo: localDemoRepository, auth: createDemoAuth(adults) } };
  }
  const { db, auth } = createBrowserServices(config.url, config.anonKey);
  return { ok: true, services: { repo: createSupabaseRepository(db), auth } };
}

let cached: ServicesResult | undefined;
/** The app's services, built once from the environment. */
export function defaultServices(): ServicesResult {
  cached ??= createServices(readConfig(import.meta.env as Record<string, string | undefined>));
  return cached;
}
