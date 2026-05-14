// Real-Postgres Row-Level Security isolation test.
//
// pglite (local dev + the CI Docker smoke test) silently ignores RLS, so the
// only way to verify the policies actually enforce is to run against a real
// Postgres. This script does exactly that — CI points DATABASE_URL at a
// Postgres service container and runs the migrations as a NON-superuser role
// that owns the tables (mirroring prod, where the app's Managed Identity owns
// the tables and FORCE ROW LEVEL SECURITY applies to it).
//
// It seeds two engagements and asserts that engagement A cannot read, write,
// or update engagement B's rows — and that a query with no engagement scope
// at all sees nothing (fail-closed).

import { withEngagement, withBypassRls, getDb, getBaseDb, closeDb, getDbEngine } from '@/lib/db';
import { runMigrations } from '@/lib/migrations/runner';

let failures = 0;

function check(cond: boolean, msg: string): void {
  if (cond) {
    console.log(`  ok   ${msg}`);
  } else {
    console.error(`  FAIL ${msg}`);
    failures += 1;
  }
}

async function main(): Promise<void> {
  await runMigrations();

  if (getDbEngine() !== 'postgres') {
    throw new Error(
      'test-rls-isolation must run against real Postgres (set DATABASE_URL=postgres://...). ' +
      'pglite does not enforce RLS, so this test would be meaningless there.',
    );
  }

  // ---- Setup: two engagements, one PBC row each. Cross-engagement work, so
  // it runs with RLS bypassed (exactly what withBypassRls is for).
  const { a, b } = await withBypassRls(async (db) => {
    await db.query(`DELETE FROM pbc_items WHERE num >= 90000`);
    await db.query(`DELETE FROM engagements WHERE slug IN ('rls-test-a', 'rls-test-b')`);
    const a = (await db.query<{ id: number }>(
      `INSERT INTO engagements (slug, name, client_name) VALUES ('rls-test-a', 'RLS Test A', 'Client A') RETURNING id`,
    )).rows[0].id;
    const b = (await db.query<{ id: number }>(
      `INSERT INTO engagements (slug, name, client_name) VALUES ('rls-test-b', 'RLS Test B', 'Client B') RETURNING id`,
    )).rows[0].id;
    await db.query(
      `INSERT INTO pbc_items (engagement_id, num, category, item_requested) VALUES ($1, 90001, 'Governance', 'A-only item')`,
      [a],
    );
    await db.query(
      `INSERT INTO pbc_items (engagement_id, num, category, item_requested) VALUES ($1, 90001, 'Governance', 'B-only item')`,
      [b],
    );
    return { a, b };
  });
  console.log(`seeded engagements a=${a} b=${b}\n`);

  // 1. Scoped to A: an UNFILTERED select sees only A's rows. This is the core
  //    guarantee — a future repository query that forgets `WHERE engagement_id`
  //    still cannot leak across engagements.
  await withEngagement(a, async (db) => {
    const all = await db.query<{ engagement_id: number }>(`SELECT engagement_id FROM pbc_items`);
    check(
      all.rows.length > 0 && all.rows.every((r) => Number(r.engagement_id) === a),
      'scoped to A: unfiltered SELECT * FROM pbc_items returns only engagement A rows',
    );
  });

  // 2. Scoped to A: even an explicit WHERE engagement_id = B returns nothing.
  await withEngagement(a, async (db) => {
    const r = await db.query(`SELECT * FROM pbc_items WHERE engagement_id = $1`, [b]);
    check(r.rows.length === 0, 'scoped to A: explicit WHERE engagement_id = B returns nothing');
  });

  // 3. Scoped to A: cannot INSERT a row that belongs to B (WITH CHECK).
  await withEngagement(a, async (db) => {
    let blockedByPolicy = false;
    try {
      await db.query(
        `INSERT INTO pbc_items (engagement_id, num, category, item_requested) VALUES ($1, 90002, 'Governance', 'smuggled')`,
        [b],
      );
    } catch (e) {
      blockedByPolicy = /row-level security/i.test(String(e));
    }
    check(blockedByPolicy, 'scoped to A: INSERT with engagement_id = B is blocked by the WITH CHECK policy');
  });

  // 4. Scoped to A: an UPDATE targeting B's rows touches nothing.
  await withEngagement(a, async (db) => {
    const r = await db.query(`UPDATE pbc_items SET notes = 'tampered' WHERE engagement_id = $1`, [b]);
    check(r.rowCount === 0, 'scoped to A: UPDATE targeting engagement B affects 0 rows');
  });

  // 5. No engagement scope at all: zero rows. Fail-closed — a path that forgets
  //    withEngagement is a visible bug, never a silent cross-engagement leak.
  {
    const db = await getBaseDb();
    const r = await db.query(`SELECT * FROM pbc_items`);
    check(r.rows.length === 0, 'no engagement scope: SELECT * FROM pbc_items returns zero rows (fail-closed)');
  }

  // 6. getDb() outside a scope is the same fail-closed base handle.
  {
    const db = await getDb();
    const r = await db.query(`SELECT * FROM pbc_items`);
    check(r.rows.length === 0, 'getDb() with no active scope is fail-closed');
  }

  // 7. withBypassRls sees every engagement (this is how admin aggregates work).
  await withBypassRls(async (db) => {
    const r = await db.query<{ engagement_id: number }>(
      `SELECT DISTINCT engagement_id FROM pbc_items WHERE num >= 90000`,
    );
    const ids = r.rows.map((x) => Number(x.engagement_id));
    check(ids.includes(a) && ids.includes(b), 'withBypassRls sees rows from both engagements');
  });

  // ---- Cleanup
  await withBypassRls(async (db) => {
    await db.query(`DELETE FROM pbc_items WHERE num >= 90000`);
    await db.query(`DELETE FROM engagements WHERE slug IN ('rls-test-a', 'rls-test-b')`);
  });
}

main()
  .then(() => {
    if (failures > 0) {
      console.error(`\n${failures} RLS isolation check(s) FAILED`);
      process.exitCode = 1;
    } else {
      console.log('\nAll RLS isolation checks passed.');
    }
  })
  .catch((e) => {
    console.error('RLS isolation test errored:', e);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
