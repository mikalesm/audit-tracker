// Standalone startup-time migration runner. Designed for the production Docker
// image where the Next.js "standalone" bundle lives at /app and only the .sql
// files (not src/lib/db.ts) are copied across. Uses `pg` + `@azure/identity`
// directly so it has no transitive TypeScript-source dependency.
//
// Invoked by scripts/entrypoint.sh before `node server.js`.
//
// Env contract (Azure): PGHOST, PGPORT, PGDATABASE, PGUSER set by Bicep; AAD
// token minted via DefaultAzureCredential. For local dev / non-Azure callers,
// set DATABASE_URL=postgres://... and we use that directly.
//
// Exits 0 on success, non-zero on any failure. stdout/stderr only — no JSON.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DefaultAzureCredential } from '@azure/identity';

const { Pool } = pg;
const SCOPE = 'https://ossrdbms-aad.database.windows.net/.default';

const here = dirname(fileURLToPath(import.meta.url));
// Migrations live one level up: /app/src/lib/migrations/*.sql
const MIGRATIONS_DIR = resolve(here, '..', 'src', 'lib', 'migrations');

async function makePool() {
  const url = process.env.DATABASE_URL;
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    const ssl = process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined;
    return new Pool({ connectionString: url, ssl });
  }
  if (!process.env.PGHOST || !process.env.PGUSER || !process.env.PGDATABASE) {
    throw new Error('migrate-startup: need PGHOST/PGUSER/PGDATABASE or DATABASE_URL');
  }
  const cred = new DefaultAzureCredential();
  return new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    database: process.env.PGDATABASE,
    ssl: { rejectUnauthorized: false },
    password: async () => {
      const t = await cred.getToken(SCOPE);
      if (!t) throw new Error('Failed to acquire AAD token for Postgres');
      return t.token;
    },
    max: 2,
  });
}

async function main() {
  const pool = await makePool();
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const { rows } = await client.query('SELECT name FROM _migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();

    for (const f of files) {
      if (applied.has(f)) {
        console.log(`[migrate] skip   ${f}`);
        continue;
      }
      const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
      console.log(`[migrate] apply  ${f}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`migration ${f} failed: ${e && e.message ? e.message : e}`);
      }
    }
    console.log('[migrate] done');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[migrate] FAILED:', e && e.message ? e.message : e);
  process.exit(1);
});
