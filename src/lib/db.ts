import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';

export interface QueryResult<R = Record<string, unknown>> {
  rows: R[];
  rowCount: number;
}

export interface DbAdapter {
  query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
  /** Multi-statement DDL with no params. Use for migrations. */
  exec(sql: string): Promise<void>;
  withTx<T>(fn: (tx: DbAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class PgPoolAdapter implements DbAdapter {
  constructor(private pool: Pool) {}
  async query<R>(sql: string, params: unknown[] = []) {
    const r = await this.pool.query(sql, params as unknown[]);
    return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
  }
  async exec(sql: string) {
    // Plain string query → "simple query" protocol, supports multiple statements.
    await this.pool.query(sql);
  }
  async withTx<T>(fn: (tx: DbAdapter) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx: DbAdapter = {
        query: async <R,>(sql: string, params: unknown[] = []) => {
          const r = await client.query(sql, params as unknown[]);
          return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
        },
        exec: async (sql: string) => { await client.query(sql); },
        withTx: async () => { throw new Error('Nested transactions not supported'); },
        close: async () => {},
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      try { await client.query('ROLLBACK'); } catch {}
      throw e;
    } finally {
      client.release();
    }
  }
  async close() { await this.pool.end(); }
}

class PgliteAdapter implements DbAdapter {
  constructor(private pg: PGlite) {}
  async query<R>(sql: string, params: unknown[] = []) {
    const r = await this.pg.query<R>(sql, params as unknown[]);
    const affected = (r as unknown as { affectedRows?: number }).affectedRows;
    return { rows: r.rows as R[], rowCount: affected ?? r.rows.length };
  }
  async exec(sql: string) { await this.pg.exec(sql); }
  async withTx<T>(fn: (tx: DbAdapter) => Promise<T>) {
    return this.pg.transaction(async (tx) => {
      const adapter: DbAdapter = {
        query: async <R,>(sql: string, params: unknown[] = []) => {
          const r = await tx.query<R>(sql, params as unknown[]);
          const affected = (r as unknown as { affectedRows?: number }).affectedRows;
          return { rows: r.rows as R[], rowCount: affected ?? r.rows.length };
        },
        exec: async (sql: string) => { await tx.exec(sql); },
        withTx: async () => { throw new Error('Nested transactions not supported'); },
        close: async () => {},
      };
      return fn(adapter);
    }) as Promise<T>;
  }
  async close() { await this.pg.close(); }
}

// Hot-module-reload safe: stash the adapter on globalThis so reloaded modules share a single connection.
type Slot = { db: DbAdapter | null; opening: Promise<DbAdapter> | null };
const slot: Slot = ((globalThis as unknown as { __auditTrackerDb?: Slot }).__auditTrackerDb ??= { db: null, opening: null });

export function getDb(): Promise<DbAdapter> {
  if (slot.db) return Promise.resolve(slot.db);
  if (slot.opening) return slot.opening;
  slot.opening = openDb().then(d => { slot.db = d; slot.opening = null; return d; }).catch(e => { slot.opening = null; throw e; });
  return slot.opening;
}

async function openDb(): Promise<DbAdapter> {
  const url = process.env.DATABASE_URL;
  if (!url || url.startsWith('pglite:') || url === 'pglite') {
    const dataDir = url && url.startsWith('pglite:') && url.length > 'pglite:'.length
      ? url.slice('pglite:'.length)
      : path.join(process.cwd(), 'data', 'pgdata');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const pg = new PGlite(dataDir);
    await pg.waitReady;
    return new PgliteAdapter(pg);
  }
  const ssl = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString: url, ssl });
  return new PgPoolAdapter(pool);
}

export async function closeDb(): Promise<void> {
  if (slot.db) {
    try { await slot.db.close(); } catch {}
    slot.db = null;
  }
}
