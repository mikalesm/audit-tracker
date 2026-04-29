import { runMigrations } from '@/lib/migrations/runner';
import { closeDb } from '@/lib/db';

(async () => {
  try {
    const r = await runMigrations();
    console.log(`Applied: ${r.applied.length ? r.applied.join(', ') : '(none)'}`);
    console.log(`Skipped: ${r.skipped.length ? r.skipped.join(', ') : '(none)'}`);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exitCode = 1;
  } finally {
    await closeDb();
  }
})();
