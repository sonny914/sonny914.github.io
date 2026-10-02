/**
 * The small slice of the Supabase client the app uses. Keeping it this narrow lets tests run the real
 * repository against a real Postgres (see src/db/pgliteClient.ts) without any network.
 */
export interface DbError {
  message: string;
  code?: string;
  status?: number;
}

export interface DbResult<T = unknown> {
  data: T | null;
  error: DbError | null;
}

export interface DbQuery<T = unknown> extends PromiseLike<DbResult<T>> {
  select(columns?: string): DbQuery<T>;
  eq(column: string, value: unknown): DbQuery<T>;
  order(column: string, options?: { ascending?: boolean }): DbQuery<T>;
  limit(count: number): DbQuery<T>;
  maybeSingle(): PromiseLike<DbResult<T>>;
}

export interface DbTable {
  select(columns?: string): DbQuery<unknown[]>;
  insert(values: object): DbQuery<unknown[]>;
  upsert(values: object, options?: { onConflict?: string }): DbQuery<unknown[]>;
  update(values: object): DbQuery<unknown[]>;
  delete(): DbQuery<unknown[]>;
}

export interface DbClient {
  from(table: string): DbTable;
  rpc(fn: string, args?: object): PromiseLike<DbResult<unknown>>;
}
