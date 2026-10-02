import type { DbClient, DbError, DbQuery, DbResult, DbTable } from '../data/db';
import type { Session } from './testDb';

/**
 * Test-only. A minimal stand-in for the supabase-js query builder that runs each request as SQL
 * against a real Postgres session (with the real migrations, role and JWT claim), the way PostgREST
 * would. It lets the real repository code be tested end to end, with two different signed-in users,
 * without any network. It is not PostgREST: URL routing, content negotiation and JWT verification are
 * not exercised here.
 */
const q = (name: string) => `"${name.replace(/"/g, '""')}"`;

interface Plan {
  table: string;
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns: string;
  returning: boolean;
  values?: Record<string, unknown>;
  onConflict?: string;
  filters: [string, unknown][];
  orders: { column: string; ascending: boolean }[];
  limit?: number;
}

function toError(e: unknown): DbError {
  const err = e as { message?: string; code?: string };
  return { message: err.message ?? String(e), code: err.code };
}

export function pgliteDbClient(session: Session, options: { failWith?: DbError } = {}): DbClient {
  async function run(plan: Plan): Promise<DbResult<unknown>> {
    if (options.failWith) return { data: null, error: options.failWith };
    const params: unknown[] = [];
    const p = (v: unknown) => (params.push(v), `$${params.length}`);
    const where = plan.filters.length ? ` where ${plan.filters.map(([c, v]) => `${q(c)} = ${p(v)}`).join(' and ')}` : '';
    const cols = plan.columns === '*' ? '*' : plan.columns.split(',').map((c) => q(c.trim())).join(', ');
    let sql: string;

    if (plan.op === 'select') {
      const order = plan.orders.length ? ` order by ${plan.orders.map((o) => `${q(o.column)} ${o.ascending ? 'asc' : 'desc'}`).join(', ')}` : '';
      const lim = plan.limit !== undefined ? ` limit ${plan.limit}` : '';
      sql = `select coalesce(json_agg(t), '[]'::json) as data from (select ${cols} from public.${q(plan.table)}${where}${order}${lim}) t`;
    } else {
      let stmt: string;
      const v = plan.values ?? {};
      const keys = Object.keys(v);
      if (plan.op === 'insert' || plan.op === 'upsert') {
        stmt = `insert into public.${q(plan.table)} (${keys.map(q).join(', ')}) values (${keys.map((k) => p(v[k])).join(', ')})`;
        if (plan.op === 'upsert') {
          const conflict = plan.onConflict ?? 'id';
          const sets = keys.filter((k) => k !== conflict).map((k) => `${q(k)} = excluded.${q(k)}`);
          stmt += ` on conflict (${q(conflict)}) do ${sets.length ? `update set ${sets.join(', ')}` : 'nothing'}`;
        }
      } else if (plan.op === 'update') {
        stmt = `update public.${q(plan.table)} set ${keys.map((k) => `${q(k)} = ${p(v[k])}`).join(', ')}${where}`;
      } else {
        stmt = `delete from public.${q(plan.table)}${where}`;
      }
      sql = plan.returning
        ? `with r as (${stmt} returning ${cols}) select coalesce(json_agg(r), '[]'::json) as data from r`
        : `select null::json as data from (select 1) x where false`;
      if (!plan.returning) {
        try {
          await session.query(stmt, params);
          return { data: null, error: null };
        } catch (e) {
          return { data: null, error: toError(e) };
        }
      }
    }
    try {
      const rows = await session.query<{ data: unknown }>(sql, params);
      return { data: rows[0]?.data ?? null, error: null };
    } catch (e) {
      return { data: null, error: toError(e) };
    }
  }

  function builder(plan: Plan): DbQuery<unknown[]> {
    const next = (patch: Partial<Plan>) => builder({ ...plan, ...patch });
    const self: DbQuery<unknown[]> = {
      select: (columns = '*') => next(plan.op === 'select' ? { columns } : { columns, returning: true }),
      eq: (column, value) => next({ filters: [...plan.filters, [column, value]] }),
      order: (column, o) => next({ orders: [...plan.orders, { column, ascending: o?.ascending ?? true }] }),
      limit: (count) => next({ limit: count }),
      async maybeSingle() {
        const r = await run({ ...plan, limit: 1 });
        const rows = (r.data ?? []) as unknown[];
        return { data: (rows[0] ?? null) as unknown[] | null, error: r.error };
      },
      then: (onfulfilled, onrejected) => run(plan).then(onfulfilled as never, onrejected),
    };
    return self;
  }

  const table = (name: string): DbTable => {
    const base = (op: Plan['op'], extra: Partial<Plan> = {}): Plan => ({ table: name, op, columns: '*', returning: false, filters: [], orders: [], ...extra });
    return {
      select: (columns = '*') => builder(base('select', { columns })),
      insert: (values) => builder(base('insert', { values: values as Record<string, unknown> })),
      upsert: (values, o) => builder(base('upsert', { values: values as Record<string, unknown>, onConflict: o?.onConflict })),
      update: (values) => builder(base('update', { values: values as Record<string, unknown> })),
      delete: () => builder(base('delete')),
    };
  };

  return {
    from: table,
    async rpc(fn, args = {}) {
      if (options.failWith) return { data: null, error: options.failWith };
      const entries = Object.entries(args);
      const params = entries.map(([, v]) => v);
      const named = entries.map(([k], i) => `${k} => $${i + 1}`).join(', ');
      try {
        const rows = await session.query<{ data: unknown }>(`select to_json(public.${q(fn)}(${named})) as data`, params);
        return { data: rows[0]?.data ?? null, error: null };
      } catch (e) {
        return { data: null, error: toError(e) };
      }
    },
  };
}
