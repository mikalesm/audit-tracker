import { getDb } from '@/lib/db';
import type { PBCItem } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; num: number; category: string; item_requested: string;
  why_purpose: string; format_expected: string; priority: string;
  owner_client: string | null; status: string;
  date_requested: string | null; date_received: string | null;
  notes: string | null; tsc_mapping: unknown; internal_comments: string | null;
  linked_items: unknown; created_at: string; updated_at: string;
};

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

function toIso(v: string | Date | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rowToItem(r: Row): PBCItem {
  return {
    id: Number(r.id),
    num: Number(r.num),
    category: r.category,
    itemRequested: r.item_requested,
    whyPurpose: r.why_purpose,
    formatExpected: r.format_expected,
    priority: r.priority as PBCItem['priority'],
    ownerClient: r.owner_client,
    status: r.status as PBCItem['status'],
    dateRequested: toIso(r.date_requested as unknown as string | Date | null),
    dateReceived: toIso(r.date_received as unknown as string | Date | null),
    notes: r.notes,
    tscMapping: asArray(r.tsc_mapping) as PBCItem['tscMapping'],
    internalComments: r.internal_comments,
    linkedItems: asArray(r.linked_items) as number[],
    createdAt: toIso(r.created_at as unknown as string | Date)!,
    updatedAt: toIso(r.updated_at as unknown as string | Date)!,
  };
}

export async function listPBC(): Promise<PBCItem[]> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM pbc_items ORDER BY num');
  return r.rows.map(rowToItem);
}

export async function getPBC(id: number): Promise<PBCItem | null> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM pbc_items WHERE id = $1', [id]);
  return r.rows[0] ? rowToItem(r.rows[0]) : null;
}

const COLUMN_BY_FIELD: Record<string, string> = {
  status: 'status',
  ownerClient: 'owner_client',
  dateRequested: 'date_requested',
  dateReceived: 'date_received',
  notes: 'notes',
  internalComments: 'internal_comments',
  priority: 'priority',
  tscMapping: 'tsc_mapping',
  linkedItems: 'linked_items',
  category: 'category',
  itemRequested: 'item_requested',
  whyPurpose: 'why_purpose',
  formatExpected: 'format_expected',
};

const JSON_COLUMNS = new Set(['tsc_mapping', 'linked_items']);
const DATE_COLUMNS = new Set(['date_requested', 'date_received']);

function normalizeForWrite(col: string, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  if (JSON_COLUMNS.has(col)) {
    return JSON.stringify(Array.isArray(value) ? value : []);
  }
  if (DATE_COLUMNS.has(col)) {
    // accept 'YYYY-MM-DD' or ISO datetime; let Postgres coerce
    return String(value).slice(0, 10);
  }
  return String(value);
}

function compareForActivity(col: string, oldVal: unknown, newVal: unknown): { oldStr: string | null; newStr: string | null; changed: boolean } {
  const old = oldVal === null || oldVal === undefined ? null
    : JSON_COLUMNS.has(col) ? JSON.stringify(asArray(oldVal))
    : DATE_COLUMNS.has(col) ? toIso(oldVal as string | Date)?.slice(0, 10) ?? null
    : String(oldVal);
  const next = newVal === null ? null : String(newVal);
  return { oldStr: old, newStr: next, changed: old !== next };
}

export async function updatePBC(id: number, patch: Record<string, unknown>, userId: number | null = null): Promise<PBCItem> {
  const db = await getDb();
  const existing = (await db.query<Row>('SELECT * FROM pbc_items WHERE id = $1', [id])).rows[0];
  if (!existing) throw new Error(`PBC item ${id} not found`);

  await db.withTx(async (tx) => {
    for (const [field, value] of Object.entries(patch)) {
      const col = COLUMN_BY_FIELD[field];
      if (!col) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[col];
      const newVal = normalizeForWrite(col, value);
      const { oldStr, newStr, changed } = compareForActivity(col, oldVal, newVal);
      if (!changed) continue;
      const cast = JSON_COLUMNS.has(col) ? '::jsonb' : DATE_COLUMNS.has(col) ? '::date' : '';
      await tx.query(
        `UPDATE pbc_items SET ${col} = $1${cast}, updated_at = NOW() WHERE id = $2`,
        [newStr, id]
      );
      await logActivity('pbc', id, field, oldStr, newStr, userId, tx);
    }
  });

  const updated = await getPBC(id);
  if (!updated) throw new Error(`PBC item ${id} disappeared after update`);
  return updated;
}

export async function pbcStatusCounts() {
  const db = await getDb();
  const r = await db.query<{ status: string; count: string | number }>(
    'SELECT status, COUNT(*)::int as count FROM pbc_items GROUP BY status'
  );
  return r.rows.map(x => ({ status: x.status, count: Number(x.count) }));
}

export async function pbcCategoryStatus() {
  const db = await getDb();
  const r = await db.query<{ category: string; status: string; count: string | number }>(
    'SELECT category, status, COUNT(*)::int as count FROM pbc_items GROUP BY category, status'
  );
  return r.rows.map(x => ({ category: x.category, status: x.status, count: Number(x.count) }));
}

export async function pbcPriorityCounts() {
  const db = await getDb();
  const r = await db.query<{ priority: string; count: string | number }>(
    'SELECT priority, COUNT(*)::int as count FROM pbc_items GROUP BY priority'
  );
  return r.rows.map(x => ({ priority: x.priority, count: Number(x.count) }));
}

export async function pbcOutstandingHigh(): Promise<number> {
  const db = await getDb();
  const r = await db.query<{ c: string | number }>(
    `SELECT COUNT(*)::int as c FROM pbc_items WHERE priority = 'High' AND status NOT IN ('Received','Reviewed','N/A')`
  );
  return Number(r.rows[0]?.c ?? 0);
}

export async function pbcReceivedTrend(days: number) {
  const db = await getDb();
  const r = await db.query<{ day: string; count: string | number }>(
    `SELECT TO_CHAR(DATE(ts), 'YYYY-MM-DD') AS day, COUNT(DISTINCT entity_id)::int AS count
     FROM activity_log
     WHERE entity_type = 'pbc' AND field = 'status' AND new_value = 'Received'
       AND ts >= NOW() - ($1 || ' days')::interval
     GROUP BY DATE(ts)
     ORDER BY day`,
    [days]
  );
  return r.rows.map(x => ({ day: x.day, count: Number(x.count) }));
}

export async function pbcOverdue() {
  const db = await getDb();
  const r = await db.query<Row>(
    `SELECT * FROM pbc_items
     WHERE date_requested IS NOT NULL
       AND date_received IS NULL
       AND status NOT IN ('Received','Reviewed','N/A')
       AND (NOW()::date - date_requested) > 7
     ORDER BY date_requested ASC`
  );
  return r.rows;
}
