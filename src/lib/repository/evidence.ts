import { getDb } from '@/lib/db';
import type { EvidenceFile } from '@/types';
import { logActivity } from './activity';
import { evidenceContainerFor } from '@/lib/blob';

type Row = {
  id: number; engagement_id: number; item_id: number; filename: string; size: number | string;
  uploaded_at: string | Date; stored_path: string; uploaded_by_id: number | null;
  uploaded_by_email: string | null; uploaded_by_name: string | null;
};

// Lightweight extension → MIME map. Only used for the UI (icons + inline view);
// the real `Content-Type` is what was set on the blob at upload time.
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  csv: 'text/csv', tsv: 'text/tab-separated-values', txt: 'text/plain', md: 'text/markdown',
  json: 'application/json', xml: 'application/xml',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip', '7z': 'application/x-7z-compressed', rar: 'application/x-rar-compressed',
  tar: 'application/x-tar', gz: 'application/gzip',
};

function mimeFromFilename(name: string): string | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(name);
  if (!m) return null;
  return MIME_BY_EXT[m[1].toLowerCase()] ?? null;
}

function toItem(r: Row): EvidenceFile {
  return {
    id: Number(r.id),
    itemId: Number(r.item_id),
    filename: r.filename,
    size: Number(r.size),
    uploadedAt: r.uploaded_at instanceof Date ? r.uploaded_at.toISOString() : String(r.uploaded_at),
    storedPath: r.stored_path,
    contentType: mimeFromFilename(r.filename),
    uploadedById: r.uploaded_by_id === null ? null : Number(r.uploaded_by_id),
    uploadedByEmail: r.uploaded_by_email,
    uploadedByName: r.uploaded_by_name,
  };
}

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._\- ]/g, '_').slice(0, 200);
}

const SELECT_WITH_UPLOADER = `
  SELECT e.id, e.engagement_id, e.item_id, e.filename, e.size, e.uploaded_at,
         e.stored_path, e.uploaded_by_id,
         u.email AS uploaded_by_email, u.display_name AS uploaded_by_name
    FROM evidence_files e
    LEFT JOIN users u ON u.id = e.uploaded_by_id`;

export async function listEvidence(engagementId: number, itemId: number): Promise<EvidenceFile[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    `${SELECT_WITH_UPLOADER}
     WHERE e.engagement_id = $1 AND e.item_id = $2
     ORDER BY e.uploaded_at DESC`,
    [engagementId, itemId]
  );
  return r.rows.map(toItem);
}

export async function saveEvidence(
  engagementId: number,
  itemId: number,
  originalFilename: string,
  buffer: Buffer,
  contentType: string | undefined,
  userId: number | null = null,
): Promise<EvidenceFile> {
  const ts = Date.now();
  const safe = safeFilename(originalFilename);
  // Per-engagement blob path prefix isolates engagements even if a future
  // bug omits the engagement_id WHERE on the SQL side.
  const blobName = `eng-${engagementId}/${itemId}/${ts}-${safe}`;

  // Prefer the filename-derived MIME whenever the browser-supplied type is
  // missing or generic — otherwise the blob ends up tagged as
  // `application/octet-stream` and browsers force a download instead of an
  // inline preview.
  const supplied = (contentType || '').trim().toLowerCase();
  const isGeneric = !supplied || supplied === 'application/octet-stream' || supplied === 'binary/octet-stream';
  const blobContentType = isGeneric
    ? (mimeFromFilename(originalFilename) || 'application/octet-stream')
    : contentType!;

  const container = await evidenceContainerFor(engagementId);
  await container.uploadBlockBlob(blobName, buffer, buffer.length, {
    blobHTTPHeaders: { blobContentType },
    metadata: {
      uploadedby: userId === null ? '' : String(userId),
      originalfilename: originalFilename,
      engagementid: String(engagementId),
    },
  });

  const db = await getDb();
  const r = await db.query<{ id: number }>(
    `INSERT INTO evidence_files (engagement_id, item_id, filename, size, stored_path, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [engagementId, itemId, originalFilename, buffer.length, blobName, userId]
  );
  await logActivity(engagementId, 'pbc', itemId, 'evidence_added', null, originalFilename, userId);
  const back = await db.query<Row>(
    `${SELECT_WITH_UPLOADER} WHERE e.id = $1`,
    [Number(r.rows[0].id)],
  );
  return toItem(back.rows[0]);
}

export async function deleteEvidence(
  engagementId: number,
  id: number,
  userId: number | null = null,
): Promise<void> {
  const db = await getDb();
  const row = (await db.query<{ item_id: number; stored_path: string; filename: string }>(
    'SELECT item_id, stored_path, filename FROM evidence_files WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  if (!row) return;

  const container = await evidenceContainerFor(engagementId);
  try { await container.deleteBlob(row.stored_path); } catch {}

  await db.query(
    'DELETE FROM evidence_files WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  );
  await logActivity(engagementId, 'pbc', Number(row.item_id), 'evidence_deleted', row.filename, null, userId);
}

/**
 * Server-side download: returns the blob's contents in memory along with the
 * original filename and content type. Replaces the SAS-URL-redirect path —
 * works on Azurite, Azure Managed Identity, and pglite alike, and avoids the
 * need for the `Storage Blob Delegator` role on the storage account.
 *
 * For evidence (PDFs, screenshots, spreadsheets — typically a few MB each)
 * loading into a Buffer is acceptable. Switch to streaming if files balloon.
 */
export async function getEvidenceForDownload(
  engagementId: number,
  id: number,
): Promise<{ filename: string; contentType: string; buffer: Buffer } | null> {
  const db = await getDb();
  const row = (await db.query<{ stored_path: string; filename: string }>(
    'SELECT stored_path, filename FROM evidence_files WHERE engagement_id = $1 AND id = $2',
    [engagementId, id]
  )).rows[0];
  if (!row) return null;
  const container = await evidenceContainerFor(engagementId);
  const blob = container.getBlobClient(row.stored_path);
  const buffer = await blob.downloadToBuffer();
  // Some uploads land in blob storage as `application/octet-stream` (the
  // browser didn't supply a type). That forces a download instead of an
  // inline preview, so prefer the filename-derived MIME whenever the stored
  // type is missing or generic.
  const props = await blob.getProperties().catch(() => null);
  const blobType = props?.contentType?.trim().toLowerCase() || '';
  const fromName = mimeFromFilename(row.filename);
  const usable = blobType && blobType !== 'application/octet-stream' && blobType !== 'binary/octet-stream';
  const contentType = usable ? props!.contentType! : (fromName || 'application/octet-stream');
  return { filename: row.filename, contentType, buffer };
}

/** Minimal metadata for permission checks (who uploaded a given file). */
export async function getEvidenceMeta(
  engagementId: number,
  id: number,
): Promise<{ uploadedById: number | null } | null> {
  const db = await getDb();
  const r = await db.query<{ uploaded_by_id: number | null }>(
    'SELECT uploaded_by_id FROM evidence_files WHERE engagement_id = $1 AND id = $2',
    [engagementId, id],
  );
  if (r.rows.length === 0) return null;
  return { uploadedById: r.rows[0].uploaded_by_id === null ? null : Number(r.rows[0].uploaded_by_id) };
}
