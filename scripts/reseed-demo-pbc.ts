// One-off: re-seed the `demo` engagement's entities + PBC list under the new
// entity-scoped model. The demo has no real evidence, so wiping and re-seeding
// PBC is safe. Run with `npx tsx scripts/reseed-demo-pbc.ts` after migration
// 0008 and the library changes have landed, then restart the dev server.
import { getEngagementBySlug, seedPbcItems, type SeededEntity } from '@/lib/repository/engagements';
import { LIBRARY, FULL_LIBRARY_SELECTION } from '@/lib/templates/library';
import { withEngagement, closeDb } from '@/lib/db';

(async () => {
  try {
    const eng = await getEngagementBySlug('demo');
    if (!eng) throw new Error("engagement 'demo' not found");

    await withEngagement(eng.id, async (db) => {
      // Wipe PBC + entities (delete PBC first — entity_id FKs it).
      await db.query("DELETE FROM activity_log WHERE engagement_id = $1 AND entity_type = 'pbc'", [eng.id]);
      await db.query('DELETE FROM pbc_items WHERE engagement_id = $1', [eng.id]);
      await db.query('DELETE FROM entities WHERE engagement_id = $1', [eng.id]);

      // Re-seed the LIBRARY entities (HQ + EU are in scope) and capture ids.
      const entityRows: SeededEntity[] = [];
      let n = 0;
      for (const e of LIBRARY.entities) {
        n += 1;
        const r = await db.query<{ id: number }>(
          `INSERT INTO entities (
              engagement_id, num, legal_entity, country_location, it_model,
              key_applications, hosting, headcount, in_scope, rationale
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id`,
          [eng.id, n, e.legalEntity, e.countryLocation, e.itModel,
           e.keyApplications, e.hosting, e.headcount, e.inScope, e.rationale],
        );
        entityRows.push({ id: Number(r.rows[0].id), inScope: e.inScope });
      }

      // Re-seed PBC: group items once, per-entity items per in-scope entity.
      await seedPbcItems(db, eng.id, entityRows, FULL_LIBRARY_SELECTION);

      const counts = await db.query<{ total: number; perEntity: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(entity_id)::int AS "perEntity"
           FROM pbc_items WHERE engagement_id = $1`,
        [eng.id],
      );
      console.log(
        `demo re-seeded: ${entityRows.length} entities (` +
        `${entityRows.filter(e => e.inScope === 'Y').length} in scope), ` +
        `${counts.rows[0].total} PBC items (${counts.rows[0].perEntity} per-entity instances)`,
      );
    });
  } catch (e) {
    console.error('reseed-demo-pbc failed:', e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
