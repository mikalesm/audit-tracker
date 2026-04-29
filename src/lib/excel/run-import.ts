import path from 'path';
import { importFromExcelPath } from './import';
import { closeDb } from '@/lib/db';
import { runMigrations } from '@/lib/migrations/runner';

const file = process.argv[2] || path.join(process.cwd(), 'data', 'import', 'IT_Audit_PBC_Tracker_v2.xlsx');

(async () => {
  try {
    await runMigrations();
    const summary = await importFromExcelPath(file);
    console.log('Import summary:');
    console.log(JSON.stringify(summary, null, 2));
  } catch (e) {
    console.error('Import failed:', e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
