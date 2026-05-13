import { getDb, type DbAdapter } from '@/lib/db';
import type { ActivityLog } from '@/types';

/**
 * Append a row to activity_log. Pass an explicit `tx` adapter to write inside an
 * existing transaction; otherwise a fresh connection is used.
 */
export async function logActivity(
  engagementId: number,
  entityType: string,
  entityId: number,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  userId: number | null = null,
  tx?: DbAdapter,
): Promise<void> {
  const db = tx ?? (await getDb());
  await db.query(
    `INSERT INTO activity_log (engagement_id, entity_type, entity_id, field, old_value, new_value, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [engagementId, entityType, entityId, field, oldValue, newValue, userId]
  );
}

type LogRow = {
  id: number; entity_type: string; entity_id: number;
  field: string; old_value: string | null; new_value: string | null;
  ts: string; user_id: number | null;
};

function toLog(r: LogRow): ActivityLog {
  return {
    id: Number(r.id),
    entityType: r.entity_type,
    entityId: Number(r.entity_id),
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    ts: typeof r.ts === 'string' ? r.ts : new Date(r.ts as unknown as Date).toISOString(),
  };
}

export async function recentActivity(engagementId: number, limit = 50): Promise<ActivityLog[]> {
  const db = await getDb();
  const r = await db.query<LogRow>(
    `SELECT id, entity_type, entity_id, field, old_value, new_value, ts, user_id
     FROM activity_log WHERE engagement_id = $1 ORDER BY ts DESC LIMIT $2`,
    [engagementId, limit]
  );
  return r.rows.map(toLog);
}

export async function activityFor(
  engagementId: number,
  entityType: string,
  entityId: number,
): Promise<ActivityLog[]> {
  const db = await getDb();
  const r = await db.query<LogRow>(
    `SELECT id, entity_type, entity_id, field, old_value, new_value, ts, user_id
     FROM activity_log
      WHERE engagement_id = $1 AND entity_type = $2 AND entity_id = $3
      ORDER BY ts DESC`,
    [engagementId, entityType, entityId]
  );
  return r.rows.map(toLog);
}

export interface RecentPBCActivityRow {
  id: number; field: string; oldValue: string | null; newValue: string | null;
  ts: string; num: number; title: string; pbcId: number;
}

export async function recentPBCActivityWithTitles(
  engagementId: number,
  limit = 10,
): Promise<RecentPBCActivityRow[]> {
  const db = await getDb();
  const r = await db.query<{
    id: number; field: string; old_value: string | null; new_value: string | null;
    ts: string; num: number; title: string; pbc_id: number;
  }>(
    `SELECT a.id, a.field, a.old_value, a.new_value, a.ts,
            p.num, p.item_requested AS title, p.id AS pbc_id
     FROM activity_log a
     JOIN pbc_items p ON p.id = a.entity_id AND p.engagement_id = a.engagement_id
     WHERE a.engagement_id = $1 AND a.entity_type = 'pbc'
     ORDER BY a.ts DESC
     LIMIT $2`,
    [engagementId, limit]
  );
  return r.rows.map(x => ({
    id: Number(x.id), field: x.field, oldValue: x.old_value, newValue: x.new_value,
    ts: typeof x.ts === 'string' ? x.ts : new Date(x.ts as unknown as Date).toISOString(),
    num: Number(x.num), title: x.title, pbcId: Number(x.pbc_id),
  }));
}

export interface TimelineEntry {
  id: number; ts: string; entityType: string; entityId: number;
  field: string; oldValue: string | null; newValue: string | null;
  num: number | null; title: string | null;
}

export async function engagementTimeline(
  engagementId: number,
  limit = 500,
): Promise<TimelineEntry[]> {
  const db = await getDb();
  const r = await db.query<{
    id: number; ts: string; entity_type: string; entity_id: number;
    field: string; old_value: string | null; new_value: string | null;
    num: number | null; title: string | null;
  }>(
    `SELECT
      a.id, a.ts, a.entity_type, a.entity_id,
      a.field, a.old_value, a.new_value,
      CASE a.entity_type
        WHEN 'pbc'         THEN (SELECT num FROM pbc_items       WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'access'      THEN (SELECT num FROM access_requests WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'walkthrough' THEN (SELECT num FROM walkthroughs    WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'entity'      THEN (SELECT num FROM entities        WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'sampling'    THEN (SELECT num FROM sampling_items  WHERE id = a.entity_id AND engagement_id = a.engagement_id)
      END AS num,
      CASE a.entity_type
        WHEN 'pbc'         THEN (SELECT item_requested FROM pbc_items       WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'access'      THEN (SELECT system          FROM access_requests WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'walkthrough' THEN (SELECT process_area    FROM walkthroughs    WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'entity'      THEN (SELECT legal_entity    FROM entities        WHERE id = a.entity_id AND engagement_id = a.engagement_id)
        WHEN 'sampling'    THEN (SELECT control_area    FROM sampling_items  WHERE id = a.entity_id AND engagement_id = a.engagement_id)
      END AS title
    FROM activity_log a
    WHERE a.engagement_id = $1
    ORDER BY a.ts DESC
    LIMIT $2`,
    [engagementId, limit]
  );
  return r.rows.map(x => ({
    id: Number(x.id),
    ts: typeof x.ts === 'string' ? x.ts : new Date(x.ts as unknown as Date).toISOString(),
    entityType: x.entity_type,
    entityId: Number(x.entity_id),
    field: x.field,
    oldValue: x.old_value,
    newValue: x.new_value,
    num: x.num === null ? null : Number(x.num),
    title: x.title,
  }));
}
