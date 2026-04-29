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

export async function listSavedViews(scope: string, userId: number | null = null): Promise<SavedView[]> {
  const db = await getDb();
  // Show globally-shared views (created_by_id IS NULL) + the requesting user's own.
  const r = await db.query<Row>(
    `SELECT * FROM saved_views
     WHERE scope = $1 AND (created_by_id IS NULL OR created_by_id = $2)
     ORDER BY created_at DESC`,
    [scope, userId]
  );
  return r.rows.map(toView);
}

export async function createSavedView(
  scope: string,
  name: string,
  filters: Record<string, unknown>,
  userId: number | null = null,
): Promise<SavedView> {
  const db = await getDb();
  const r = await db.query<Row>(
    `INSERT INTO saved_views (scope, name, filters_json, created_by_id)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING *`,
    [scope, name, JSON.stringify(filters), userId]
  );
  return toView(r.rows[0]);
}

export async function deleteSavedView(id: number): Promise<void> {
  const db = await getDb();
  await db.query('DELETE FROM saved_views WHERE id = $1', [id]);
}
