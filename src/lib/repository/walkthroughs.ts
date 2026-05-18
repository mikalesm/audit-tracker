import { getDb } from '@/lib/db';
import type { Walkthrough } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; engagement_id: number; num: number; process_area: string;
  description: string | null; objective: string | null;
  key_topics: string; attendees: string;
  proposed_date: string | Date | null; duration_min: number | null; status: string;
  notes: string | null; updated_at: string | Date;
};

function dateOnly(v: string | Date | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toItem(r: Row): Walkthrough {
  return {
    id: Number(r.id), num: Number(r.num), processArea: r.process_area,
    description: r.description, objective: r.objective,
    keyTopics: r.key_topics,
    attendees: r.attendees, proposedDate: dateOnly(r.proposed_date),
    durationMin: r.duration_min === null ? null : Number(r.duration_min),
    status: r.status as Walkthrough['status'], notes: r.notes,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function listWalkthroughs(engagementId: number): Promise<Walkthrough[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    'SELECT * FROM walkthroughs WHERE engagement_id = $1 ORDER BY num',
    [engagementId]
  );
  return r.rows.map(toItem);
}

const COLS: Record<string, string> = {
  status: 'status', proposedDate: 'proposed_date', durationMin: 'duration_min',
  notes: 'notes', processArea: 'process_area', keyTopics: 'key_topics', attendees: 'attendees',
  description: 'description', objective: 'objective',
};
const DATE_COLS = new Set(['proposed_date']);
const INT_COLS = new Set(['duration_min']);

export async function updateWalkthrough(
  engagementId: number,
  id: number,
  patch: Record<string, unknown>,
  userId: number | null = null,
): Promise<Walkthrough> {
  const db = await getDb();
  const existing = (await db.query<Row>(
    'SELECT * FROM walkthroughs WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  if (!existing) throw new Error('not found');

  await db.withTx(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      const col = COLS[k]; if (!col) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[col];
      let newVal: string | number | null;
      if (v === null || v === undefined || v === '') {
        newVal = null;
      } else if (DATE_COLS.has(col)) {
        newVal = String(v).slice(0, 10);
      } else if (INT_COLS.has(col)) {
        const n = parseInt(String(v), 10); newVal = isNaN(n) ? null : n;
      } else {
        newVal = String(v);
      }
      const oldStr = oldVal === null || oldVal === undefined ? null
        : DATE_COLS.has(col) ? dateOnly(oldVal as string | Date)
        : String(oldVal);
      const newStr = newVal === null ? null : String(newVal);
      if (oldStr === newStr) continue;
      const cast = DATE_COLS.has(col) ? '::date' : INT_COLS.has(col) ? '::int' : '';
      await tx.query(
        `UPDATE walkthroughs SET ${col} = $1${cast}, updated_at = NOW() WHERE engagement_id = $2 AND id = $3`,
        [newVal, engagementId, id]
      );
      await logActivity(engagementId, 'walkthrough', id, k, oldStr, newStr, userId, tx);
    }
  });

  const fresh = (await db.query<Row>(
    'SELECT * FROM walkthroughs WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  return toItem(fresh);
}

export async function createWalkthrough(
  engagementId: number,
  payload: Record<string, unknown>,
  userId: number | null = null,
): Promise<Walkthrough> {
  const processArea = String(payload.processArea ?? '').trim();
  if (!processArea) throw new Error('processArea is required');

  const db = await getDb();
  const next = (await db.query<{ n: number }>(
    'SELECT COALESCE(MAX(num), 0) + 1 AS n FROM walkthroughs WHERE engagement_id = $1',
    [engagementId]
  )).rows[0].n;

  const description = payload.description === undefined || payload.description === '' ? null : String(payload.description);
  const objective = payload.objective === undefined || payload.objective === '' ? null : String(payload.objective);
  const keyTopics = String(payload.keyTopics ?? '');
  const attendees = String(payload.attendees ?? '');
  const inserted = (await db.query<Row>(
    `INSERT INTO walkthroughs
       (engagement_id, num, process_area, description, objective, key_topics, attendees)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [engagementId, next, processArea, description, objective, keyTopics, attendees]
  )).rows[0];

  await logActivity(engagementId, 'walkthrough', Number(inserted.id), 'created', null, processArea, userId);
  return toItem(inserted);
}

export async function upcomingWalkthroughs(engagementId: number, days: number) {
  const db = await getDb();
  const r = await db.query<Row>(
    `SELECT * FROM walkthroughs
     WHERE engagement_id = $1
       AND proposed_date IS NOT NULL
       AND proposed_date >= CURRENT_DATE
       AND proposed_date <= CURRENT_DATE + ($2 || ' days')::interval
     ORDER BY proposed_date ASC`,
    [engagementId, days]
  );
  return r.rows;
}
