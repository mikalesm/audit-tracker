import { getDb } from '@/lib/db';
import type { EngagementSettings } from '@/types';

export async function getSettings(engagementId: number): Promise<EngagementSettings> {
  const db = await getDb();
  const r = await db.query<{ key: string; value: string }>(
    'SELECT key, value FROM settings WHERE engagement_id = $1',
    [engagementId]
  );
  const map = Object.fromEntries(r.rows.map(row => [row.key, row.value]));
  return {
    clientName:   map.clientName   || 'Client Name',
    auditPeriod:  map.auditPeriod  || 'FY2026',
    leadAuditor:  map.leadAuditor  || 'Lead Auditor',
    sponsor:      map.sponsor      || 'Audit Sponsor',
    projectTitle: map.projectTitle || 'IT Audit — PBC Tracker',
  };
}

export async function updateSettings(engagementId: number, patch: Partial<EngagementSettings>) {
  const db = await getDb();
  await db.withTx(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === null) continue;
      await tx.query(
        `INSERT INTO settings (engagement_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (engagement_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [engagementId, k, String(v)]
      );
    }
  });
  return getSettings(engagementId);
}
