import { Pool, type PoolConfig } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';

export type DbEngine = 'pglite' | 'postgres';
let activeEngine: DbEngine = 'pglite';
export function getDbEngine(): DbEngine { return activeEngine; }

const OSS_RDBMS_SCOPE = 'https://ossrdbms-aad.database.windows.net/.default';
let cachedToken: { token: string; expiresOnMs: number } | null = null;

async function fetchPgAadToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresOnMs - Date.now() > 5 * 60_000) return cachedToken.token;
  const { DefaultAzureCredential } = await import('@azure/identity');
  const cred = new DefaultAzureCredential();
  const t = await cred.getToken(OSS_RDBMS_SCOPE);
  if (!t) throw new Error('Failed to acquire AAD token for Postgres (oss-rdbms scope)');
  cachedToken = { token: t.token, expiresOnMs: t.expiresOnTimestamp };
  return t.token;
}

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
  const hasAadConfig = !!(process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE);
  const useAad = hasAadConfig && (!url || url === 'aad');

  if (useAad) {
    // Azure path: pg.Pool with a dynamic password callback that mints a fresh
    // AAD token. Tokens last ~24 h; the callback re-fetches when expired.
    const config: PoolConfig = {
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER,
      database: process.env.PGDATABASE,
      ssl: { rejectUnauthorized: false },
      password: fetchPgAadToken,
      max: 10,
    };
    const pool = new Pool(config);
    activeEngine = 'postgres';
    return new PgPoolAdapter(pool);
  }

  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const ssl = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;
    const pool = new Pool({ connectionString: url, ssl });
    activeEngine = 'postgres';
    return new PgPoolAdapter(pool);
  }

  // Local dev fallback: embedded pglite. Refuse to use it in Azure App Service.
  if (process.env.WEBSITE_SITE_NAME) {
    throw new Error(
      'Refusing to start with embedded pglite in Azure App Service. ' +
      'Set PGHOST/PGUSER/PGDATABASE for AAD auth, or DATABASE_URL=postgres://… ' +
      '(WEBSITE_SITE_NAME is set, indicating App Service runtime).'
    );
  }
  const dataDir = url && url.startsWith('pglite:') && url.length > 'pglite:'.length
    ? url.slice('pglite:'.length)
    : path.join(process.cwd(), 'data', 'pgdata');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  activeEngine = 'pglite';
  return new PgliteAdapter(pg);
}

export async function closeDb(): Promise<void> {
  if (slot.db) {
    try { await slot.db.close(); } catch {}
    slot.db = null;
  }
}
