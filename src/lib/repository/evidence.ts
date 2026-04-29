import { getDb } from '@/lib/db';
import type { EvidenceFile } from '@/types';
import { logActivity } from './activity';
import { evidenceContainer, downloadSasUrl } from '@/lib/blob';

type Row = {
  id: number; item_id: number; filename: string; size: number | string;
  uploaded_at: string | Date; stored_path: string; uploaded_by_id: number | null;
};

function toItem(r: Row): EvidenceFile {
  return {
    id: Number(r.id),
    itemId: Number(r.item_id),
    filename: r.filename,
    size: Number(r.size),
    uploadedAt: r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
    storedPath: r.stored_path,
  };
}

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._\- ]/g, '_').slice(0, 200);
}

export async function listEvidence(itemId: number): Promise<EvidenceFile[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    `SELECT id, item_id, filename, size, uploaded_at, stored_path, uploaded_by_id
     FROM evidence_files WHERE item_id = $1 ORDER BY uploaded_at DESC`,
    [itemId]
  );
  return r.rows.map(toItem);
}

export async function saveEvidence(
  itemId: number,
  originalFilename: string,
  buffer: Buffer,
  contentType: string | undefined,
  userId: number | null = null,
): Promise<EvidenceFile> {
  const ts = Date.now();
  const safe = safeFilename(originalFilename);
  const blobName = `${itemId}/${ts}-${safe}`;

  const container = await evidenceContainer();
  await container.uploadBlockBlob(blobName, buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType: contentType || 'application/octet-stream' },
    metadata: {
      uploadedby: userId === null ? '' : String(userId),
      originalfilename: originalFilename,
    },
  });

  const db = await getDb();
  const r = await db.query<Row>(
    `INSERT INTO evidence_files (item_id, filename, size, stored_path, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, item_id, filename, size, uploaded_at, stored_path, uploaded_by_id`,
    [itemId, originalFilename, buffer.length, blobName, userId]
  );
  await logActivity('pbc', itemId, 'evidence_added', null, originalFilename, userId);
  return toItem(r.rows[0]);
}

export async function deleteEvidence(id: number, userId: number | null = null): Promise<void> {
  const db = await getDb();
  const row = (await db.query<{ item_id: number; stored_path: string; filename: string }>(
    'SELECT item_id, stored_path, filename FROM evidence_files WHERE id = $1',
    [id]
  )).rows[0];
  if (!row) return;

  // Soft-delete in storage (relies on container-level versioning + soft-delete on Azure;
  // on Azurite the blob is removed). Either way, the row is gone.
  const container = await evidenceContainer();
  try { await container.deleteBlob(row.stored_path); } catch {}

  await db.query('DELETE FROM evidence_files WHERE id = $1', [id]);
  await logActivity('pbc', Number(row.item_id), 'evidence_deleted', row.filename, null, userId);
}

export async function getEvidenceDownloadUrl(id: number): Promise<{ url: string; filename: string } | null> {
  const db = await getDb();
  const row = (await db.query<{ stored_path: string; filename: string }>(
    'SELECT stored_path, filename FROM evidence_files WHERE id = $1',
    [id]
  )).rows[0];
  if (!row) return null;
  const url = await downloadSasUrl(row.stored_path, 30);
  return { url, filename: row.filename };
}
