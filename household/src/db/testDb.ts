import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Test-only: a real Postgres engine (PGlite) with the real migrations applied, plus a tiny stand-in for
 * the Supabase pieces the migrations rely on (`auth.users`, `auth.uid()` and the browser roles).
 *
 * This verifies the database rules (row-level security, triggers, constraints). It does NOT exercise
 * GoTrue (e-mail delivery, JWT issuing) or PostgREST (HTTP); those need a real project.
 */
export interface Cottage {
  db: PGlite;
  /** Runs as the project owner (bypasses row-level security), like the SQL editor. */
  admin: Session;
  /** Runs as a signed-in browser user. The user id is the JWT `sub`. */
  as(userId: string): Session;
  /** Runs as a browser with no sign-in (the `anon` role). */
  anon: Session;
  /** Adds an invited account the way the Supabase dashboard would. Returns the new user's id. */
  addUser(email: string): Promise<string>;
}

export interface Session {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Several statements in one go (for transactions). */
  exec(sql: string): Promise<void>;
}

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations');

export async function createCottage(): Promise<Cottage> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  for (const f of readdirSync(MIGRATIONS).filter((n: string) => n.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  }

  // One in-process connection serves every session, and "become this user, run, become nobody" takes several
  // awaits. Two browsers talking at once would otherwise interleave and run as each other, which a real
  // per-request JWT never does. Serialise whole requests.
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T,>(fn: () => Promise<T>): Promise<T> => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => undefined);
    return run;
  };

  const session = (role: 'authenticated' | 'anon' | null, sub: string): Session => ({
    query: (sql, params = []) => exclusive(async () => {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
      if (role) await db.exec(`set role ${role}`);
      try {
        return (await db.query(sql, params)).rows as never;
      } finally {
        await db.exec('reset role');
      }
    }) as never,
    exec: (sql) => exclusive(async () => {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub]);
      if (role) await db.exec(`set role ${role}`);
      try {
        await db.exec(sql);
      } catch (e) {
        await db.exec('rollback').catch(() => undefined);
        throw e;
      } finally {
        await db.exec('reset role');
      }
    }),
  });

  return {
    db,
    admin: session(null, ''),
    as: (userId) => session('authenticated', userId),
    anon: session('anon', ''),
    async addUser(email) {
      const rows = (await db.query<{ id: string }>(`insert into auth.users (email) values ($1) returning id`, [email])).rows;
      return rows[0]!.id;
    },
  };
}

/** The three invited adults, signed up the way the dashboard would. */
export async function createHousehold() {
  const c = await createCottage();
  await c.admin.exec(`
    insert into public.household_invites (email, member_id) values
      ('jay@cottage.test', 'jay'), ('fallon@cottage.test', 'fallon'), ('breeze@cottage.test', 'adult3');
  `);
  const ids = {
    jay: await c.addUser('jay@cottage.test'),
    fallon: await c.addUser('Fallon@Cottage.test'), // mixed case on purpose
    breeze: await c.addUser('breeze@cottage.test'),
  };
  return { ...c, ids, jay: c.as(ids.jay), fallon: c.as(ids.fallon), breeze: c.as(ids.breeze) };
}
