import path from 'path';
import { importFromExcelPath } from './import';
import { closeDb, getDb, withEngagement } from '@/lib/db';
import { runMigrations } from '@/lib/migrations/runner';

const file = process.argv[2] || path.join(process.cwd(), 'data', 'templates', 'IT_Audit_PBC_Tracker_v2.xlsx');
const slug = process.argv[3] || 'audit1';

(async () => {
  try {
    await runMigrations();
    const db = await getDb();
    const eng = (await db.query<{ id: number }>(
      'SELECT id FROM engagements WHERE slug = $1',
      [slug]
    )).rows[0];
    if (!eng) {
      console.error(`Engagement '${slug}' not found. Create it first via the UI.`);
      process.exitCode = 1;
      return;
    }
    const engId = Number(eng.id);
    const summary = await withEngagement(engId, () => importFromExcelPath(engId, file));
    console.log(`Import into engagement '${slug}' (id=${eng.id}):`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Import failed:', e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
