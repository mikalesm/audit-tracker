import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { AsyncLocalStorage } from 'node:async_hooks';
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
  /**
   * Run `fn` inside a transaction with the given Postgres session variables set
   * transaction-locally (via set_config(..., true)), and with the resulting
   * engagement-scoped adapter installed so that getDb() returns it for the
   * duration. This is what powers Row-Level Security: every request sets
   * `app.engagement_id` before its first query. See withEngagement / withBypassRls.
   */
  runScoped<T>(vars: Record<string, string>, fn: (db: DbAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

// Engagement-scope context. When a request runs inside withEngagement/withBypassRls,
// the scoped (transaction-bound) adapter is stashed here so getDb() returns it
// instead of a fresh pooled connection. HMR-safe via globalThis.
const scope: AsyncLocalStorage<DbAdapter> =
  ((globalThis as unknown as { __auditTrackerScope?: AsyncLocalStorage<DbAdapter> }).__auditTrackerScope ??=
    new AsyncLocalStorage<DbAdapter>());

async function applyScopeVars(
  q: (sql: string, params?: unknown[]) => Promise<unknown>,
  vars: Record<string, string>,
): Promise<void> {
  for (const [k, v] of Object.entries(vars)) {
    // set_config(name, value, is_local=true) — transaction-scoped, auto-reset
    // on COMMIT/ROLLBACK, so a pooled connection never leaks scope to the next
    // checkout. Parameterised, so values can't break out of the statement.
    await q('SELECT set_config($1, $2, true)', [k, v]);
  }
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
      const tx = makeClientTxAdapter(client);
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
  async runScoped<T>(vars: Record<string, string>, fn: (db: DbAdapter) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await applyScopeVars((sql, params) => client.query(sql, params as unknown[]), vars);
      const tx = makeClientTxAdapter(client);
      const result = await scope.run(tx, () => fn(tx));
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

// Adapter bound to a single pg client already inside a transaction. withTx is a
// passthrough (we're already in a tx); runScoped re-applies vars on the same tx.
function makeClientTxAdapter(client: PoolClient): DbAdapter {
  const adapter: DbAdapter = {
    query: async <R,>(sql: string, params: unknown[] = []) => {
      const r = await client.query(sql, params as unknown[]);
      return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
    },
    exec: async (sql: string) => { await client.query(sql); },
    withTx: async <T,>(fn: (tx: DbAdapter) => Promise<T>) => fn(adapter),
    runScoped: async <T,>(vars: Record<string, string>, fn: (db: DbAdapter) => Promise<T>) => {
      await applyScopeVars((sql, params) => client.query(sql, params as unknown[]), vars);
      return scope.run(adapter, () => fn(adapter));
    },
    close: async () => {},
  };
  return adapter;
}

type PgliteTx = Parameters<Parameters<PGlite['transaction']>[0]>[0];

function makePgliteTxAdapter(tx: PgliteTx): DbAdapter {
  const adapter: DbAdapter = {
    query: async <R,>(sql: string, params: unknown[] = []) => {
      const r = await tx.query<R>(sql, params as unknown[]);
      const affected = (r as unknown as { affectedRows?: number }).affectedRows;
      return { rows: r.rows as R[], rowCount: affected ?? r.rows.length };
    },
    exec: async (sql: string) => { await tx.exec(sql); },
    withTx: async <T,>(fn: (t: DbAdapter) => Promise<T>) => fn(adapter),
    runScoped: async <T,>(vars: Record<string, string>, fn: (db: DbAdapter) => Promise<T>) => {
      await applyScopeVars((sql, params) => tx.query(sql, params as unknown[]), vars);
      return scope.run(adapter, () => fn(adapter));
    },
    close: async () => {},
  };
  return adapter;
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
    return this.pg.transaction(async (tx) => fn(makePgliteTxAdapter(tx))) as Promise<T>;
  }
  async runScoped<T>(vars: Record<string, string>, fn: (db: DbAdapter) => Promise<T>) {
    return this.pg.transaction(async (tx) => {
      await applyScopeVars((sql, params) => tx.query(sql, params as unknown[]), vars);
      const adapter = makePgliteTxAdapter(tx);
      return scope.run(adapter, () => fn(adapter));
    }) as Promise<T>;
  }
  async close() { await this.pg.close(); }
}

// Hot-module-reload safe: stash the adapter on globalThis so reloaded modules share a single connection.
type Slot = { db: DbAdapter | null; opening: Promise<DbAdapter> | null };
const slot: Slot = ((globalThis as unknown as { __auditTrackerDb?: Slot }).__auditTrackerDb ??= { db: null, opening: null });

/**
 * The request-aware database handle.
 *
 * Inside withEngagement / withBypassRls this returns the transaction-bound,
 * engagement-scoped adapter so every repository query runs under the right
 * RLS context. Everywhere else it returns the shared pool/pglite adapter.
 */
export function getDb(): Promise<DbAdapter> {
  const scoped = scope.getStore();
  if (scoped) return Promise.resolve(scoped);
  return getBaseDb();
}

/** The unscoped pool/pglite adapter. Used by migration runners and by getDb(). */
export function getBaseDb(): Promise<DbAdapter> {
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

/**
 * Run `fn` with every query scoped to one engagement: opens a transaction,
 * sets `app.engagement_id`, and installs the scoped adapter so repository
 * functions (which call getDb()) transparently run under Row-Level Security.
 *
 * Every API route / server component that touches an engagement's domain
 * tables must run inside this. A path that forgets it will — on real Postgres
 * with RLS forced — simply see zero rows (fail-closed), never another
 * engagement's data.
 */
export async function withEngagement<T>(
  engagementId: number,
  fn: (db: DbAdapter) => Promise<T>,
): Promise<T> {
  if (!Number.isInteger(engagementId) || engagementId <= 0) {
    throw new Error(`withEngagement: invalid engagementId ${engagementId}`);
  }
  const base = await getBaseDb();
  return base.runScoped({ 'app.engagement_id': String(engagementId) }, fn);
}

/**
 * Run `fn` with RLS bypassed. Reserved for genuinely cross-engagement work:
 * creating an engagement (reads a template engagement, writes the new one) and
 * platform-admin aggregates over every engagement. Never reachable from a
 * normal request path.
 */
export async function withBypassRls<T>(fn: (db: DbAdapter) => Promise<T>): Promise<T> {
  const base = await getBaseDb();
  return base.runScoped({ 'app.bypass_rls': 'on' }, fn);
}

export async function closeDb(): Promise<void> {
  if (slot.db) {
    try { await slot.db.close(); } catch {}
    slot.db = null;
  }
}
