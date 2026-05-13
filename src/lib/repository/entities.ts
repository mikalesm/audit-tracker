import { getDb } from '@/lib/db';
import type { Entity } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; engagement_id: number; num: number; legal_entity: string | null; country_location: string | null;
  it_model: string | null; key_applications: string | null; hosting: string | null;
  headcount: number | null; in_scope: string | null; rationale: string | null;
  updated_at: string | Date;
};

function toItem(r: Row): Entity {
  return {
    id: Number(r.id), num: Number(r.num), legalEntity: r.legal_entity, countryLocation: r.country_location,
    itModel: r.it_model, keyApplications: r.key_applications, hosting: r.hosting,
    headcount: r.headcount === null ? null : Number(r.headcount),
    inScope: r.in_scope as Entity['inScope'], rationale: r.rationale,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function listEntities(engagementId: number): Promise<Entity[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    'SELECT * FROM entities WHERE engagement_id = $1 ORDER BY num',
    [engagementId]
  );
  return r.rows.map(toItem);
}

const COLS: Record<string, string> = {
  legalEntity: 'legal_entity', countryLocation: 'country_location', itModel: 'it_model',
  keyApplications: 'key_applications', hosting: 'hosting', headcount: 'headcount',
  inScope: 'in_scope', rationale: 'rationale',
};
const INT_COLS = new Set(['headcount']);

export async function updateEntity(
  engagementId: number,
  id: number,
  patch: Record<string, unknown>,
  userId: number | null = null,
): Promise<Entity> {
  const db = await getDb();
  const existing = (await db.query<Row>(
    'SELECT * FROM entities WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  if (!existing) throw new Error('not found');

  await db.withTx(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      const col = COLS[k]; if (!col) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[col];
      let newVal: string | number | null;
      if (v === null || v === undefined || v === '') newVal = null;
      else if (INT_COLS.has(col)) {
        const n = parseInt(String(v), 10); newVal = isNaN(n) ? null : n;
      } else newVal = String(v);
      const oldStr = oldVal === null || oldVal === undefined ? null : String(oldVal);
      const newStr = newVal === null ? null : String(newVal);
      if (oldStr === newStr) continue;
      const cast = INT_COLS.has(col) ? '::int' : '';
      await tx.query(
        `UPDATE entities SET ${col} = $1${cast}, updated_at = NOW() WHERE engagement_id = $2 AND id = $3`,
        [newVal, engagementId, id]
      );
      await logActivity(engagementId, 'entity', id, k, oldStr, newStr, userId, tx);
    }
  });

  const fresh = (await db.query<Row>(
    'SELECT * FROM entities WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  return toItem(fresh);
}

export async function addEntity(engagementId: number, userId: number | null = null): Promise<Entity> {
  const db = await getDb();
  const next = (await db.query<{ n: number }>(
    'SELECT COALESCE(MAX(num), 0) + 1 AS n FROM entities WHERE engagement_id = $1',
    [engagementId]
  )).rows[0].n;
  const inserted = (await db.query<Row>(
    'INSERT INTO entities (engagement_id, num) VALUES ($1, $2) RETURNING *',
    [engagementId, next]
  )).rows[0];
  await logActivity(engagementId, 'entity', Number(inserted.id), 'created', null, String(next), userId);
  return toItem(inserted);
}

export async function deleteEntity(engagementId: number, id: number, userId: number | null = null) {
  const db = await getDb();
  await db.query(
    'DELETE FROM entities WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  );
  await logActivity(engagementId, 'entity', id, 'deleted', null, null, userId);
}

export async function entitiesInScope(engagementId: number) {
  const db = await getDb();
  const r1 = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM entities WHERE engagement_id = $1 AND in_scope = 'Y'`,
    [engagementId]
  );
  const r2 = await db.query<{ c: number }>(
    `SELECT COUNT(*)::int AS c FROM entities WHERE engagement_id = $1 AND legal_entity IS NOT NULL`,
    [engagementId]
  );
  return { inScope: Number(r1.rows[0]?.c ?? 0), total: Number(r2.rows[0]?.c ?? 0) };
}
