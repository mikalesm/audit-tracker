// Threaded notes on PBC items. Each note carries author + timestamps so the
// detail panel can render the full history. Always called inside
// withEngagement(engagementId, ...) so RLS holds.

import { getDb } from '@/lib/db';

export interface PBCNote {
  id: number;
  pbcItemId: number;
  userId: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  authorEmail: string;
  authorName: string | null;
}

type Row = {
  id: number;
  pbc_item_id: number;
  user_id: number;
  body: string;
  created_at: string | Date;
  updated_at: string | Date;
  edited_at: string | Date | null;
  author_email: string;
  author_name: string | null;
};

function toIso(v: string | Date | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function rowToNote(r: Row): PBCNote {
  return {
    id: Number(r.id),
    pbcItemId: Number(r.pbc_item_id),
    userId: Number(r.user_id),
    body: r.body,
    createdAt: toIso(r.created_at)!,
    updatedAt: toIso(r.updated_at)!,
    editedAt: toIso(r.edited_at),
    authorEmail: r.author_email,
    authorName: r.author_name,
  };
}

export async function listPBCNotes(engagementId: number, pbcItemId: number): Promise<PBCNote[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    `SELECT n.id, n.pbc_item_id, n.user_id, n.body, n.created_at, n.updated_at, n.edited_at,
            u.email AS author_email, u.display_name AS author_name
       FROM pbc_notes n
       JOIN users u ON u.id = n.user_id
      WHERE n.engagement_id = $1 AND n.pbc_item_id = $2
      ORDER BY n.created_at ASC`,
    [engagementId, pbcItemId],
  );
  return r.rows.map(rowToNote);
}

export async function addPBCNote(
  engagementId: number,
  pbcItemId: number,
  userId: number,
  body: string,
): Promise<PBCNote> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('note body cannot be empty');
  const db = await getDb();
  const ins = await db.query<{ id: number }>(
    `INSERT INTO pbc_notes (engagement_id, pbc_item_id, user_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [engagementId, pbcItemId, userId, trimmed],
  );
  const got = await db.query<Row>(
    `SELECT n.id, n.pbc_item_id, n.user_id, n.body, n.created_at, n.updated_at, n.edited_at,
            u.email AS author_email, u.display_name AS author_name
       FROM pbc_notes n
       JOIN users u ON u.id = n.user_id
      WHERE n.id = $1`,
    [Number(ins.rows[0].id)],
  );
  return rowToNote(got.rows[0]);
}

export async function updatePBCNote(
  engagementId: number,
  noteId: number,
  userId: number,
  body: string,
): Promise<PBCNote | { error: 'not_found' | 'forbidden' }> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('note body cannot be empty');
  const db = await getDb();
  const existing = (await db.query<{ user_id: number }>(
    'SELECT user_id FROM pbc_notes WHERE engagement_id = $1 AND id = $2',
    [engagementId, noteId],
  )).rows[0];
  if (!existing) return { error: 'not_found' };
  if (Number(existing.user_id) !== userId) return { error: 'forbidden' };
  await db.query(
    `UPDATE pbc_notes SET body = $1, updated_at = NOW(), edited_at = NOW()
      WHERE engagement_id = $2 AND id = $3`,
    [trimmed, engagementId, noteId],
  );
  const got = await db.query<Row>(
    `SELECT n.id, n.pbc_item_id, n.user_id, n.body, n.created_at, n.updated_at, n.edited_at,
            u.email AS author_email, u.display_name AS author_name
       FROM pbc_notes n
       JOIN users u ON u.id = n.user_id
      WHERE n.id = $1`,
    [noteId],
  );
  return rowToNote(got.rows[0]);
}

export async function deletePBCNote(
  engagementId: number,
  noteId: number,
  userId: number,
  isAuditorLead: boolean,
): Promise<{ ok: true } | { error: 'not_found' | 'forbidden' }> {
  const db = await getDb();
  const existing = (await db.query<{ user_id: number }>(
    'SELECT user_id FROM pbc_notes WHERE engagement_id = $1 AND id = $2',
    [engagementId, noteId],
  )).rows[0];
  if (!existing) return { error: 'not_found' };
  if (Number(existing.user_id) !== userId && !isAuditorLead) return { error: 'forbidden' };
  await db.query(
    'DELETE FROM pbc_notes WHERE engagement_id = $1 AND id = $2',
    [engagementId, noteId],
  );
  return { ok: true };
}
