import { getDb } from '@/lib/db';

export interface SavedView {
  id: number;
  scope: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  createdById: number | null;
}

type Row = {
  id: number; scope: string; name: string; filters_json: unknown;
  created_at: string | Date; created_by_id: number | null;
};

function toView(r: Row): SavedView {
  let filters: Record<string, unknown> = {};
  if (r.filters_json && typeof r.filters_json === 'object') {
    filters = r.filters_json as Record<string, unknown>;
  } else if (typeof r.filters_json === 'string') {
    try { filters = JSON.parse(r.filters_json); } catch { filters = {}; }
  }
  return {
    id: Number(r.id),
    scope: r.scope,
    name: r.name,
    filters,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    createdById: r.created_by_id === null ? null : Number(r.created_by_id),
  };
}

export async function listSavedViews(
  engagementId: number,
  scope: string,
  userId: number | null = null,
): Promise<SavedView[]> {
  const db = await getDb();
  // Show globally-shared views (created_by_id IS NULL) + the requesting user's own.
  const r = await db.query<Row>(
    `SELECT * FROM saved_views
     WHERE engagement_id = $1 AND scope = $2 AND (created_by_id IS NULL OR created_by_id = $3)
     ORDER BY created_at DESC`,
    [engagementId, scope, userId]
  );
  return r.rows.map(toView);
}

export async function createSavedView(
  engagementId: number,
  scope: string,
  name: string,
  filters: Record<string, unknown>,
  userId: number | null = null,
): Promise<SavedView> {
  const db = await getDb();
  const r = await db.query<Row>(
    `INSERT INTO saved_views (engagement_id, scope, name, filters_json, created_by_id)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     RETURNING *`,
    [engagementId, scope, name, JSON.stringify(filters), userId]
  );
  return toView(r.rows[0]);
}

export async function deleteSavedView(engagementId: number, id: number): Promise<void> {
  const db = await getDb();
  await db.query(
    'DELETE FROM saved_views WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  );
}
