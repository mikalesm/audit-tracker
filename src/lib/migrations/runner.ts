import fs from 'fs';
import path from 'path';
import { getBaseDb, type DbAdapter } from '@/lib/db';

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'lib', 'migrations');

export async function runMigrations(): Promise<{ applied: string[]; skipped: string[] }> {
  // Always the unscoped pool — migrations must never run on a request-scoped tx.
  const db = await getBaseDb();
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const { rows: applied } = await db.query<{ name: string }>('SELECT name FROM _migrations');
  const appliedSet = new Set(applied.map(r => r.name));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
  const result = { applied: [] as string[], skipped: [] as string[] };
  for (const f of files) {
    if (appliedSet.has(f)) { result.skipped.push(f); continue; }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    await db.withTx(async (tx: DbAdapter) => {
      // Migrations run with RLS bypassed: 0007 enables RLS, and any future data
      // migration touching a domain table would otherwise be filtered to nothing.
      await tx.query("SELECT set_config('app.bypass_rls', 'on', true)");
      // exec() handles multi-statement DDL; query() handles parameterized writes.
      await tx.exec(sql);
      await tx.query('INSERT INTO _migrations (name) VALUES ($1)', [f]);
    });
    result.applied.push(f);
  }
  return result;
}
