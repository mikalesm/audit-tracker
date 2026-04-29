import { runMigrations } from '@/lib/migrations/runner';

let migrated = false;
let migratingPromise: Promise<void> | null = null;

/**
 * Ensure the database schema is up to date. Idempotent and HMR-safe.
 *
 * On Azure this will also run on container start, but we keep the lazy guard
 * so a developer-mode hot reload doesn't try to re-apply migrations.
 *
 * Note: we no longer auto-seed from a bundled Excel file. The auditor uploads
 * the Excel via Settings → Re-import on day 1 (multi-user dataroom posture).
 */
export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  if (migratingPromise) return migratingPromise;
  migratingPromise = (async () => {
    try {
      await runMigrations();
      migrated = true;
    } finally {
      migratingPromise = null;
    }
  })();
  return migratingPromise;
}

/** Backwards-compatible export (older callers may still import this name). */
export const ensureSeed = ensureSchema;
