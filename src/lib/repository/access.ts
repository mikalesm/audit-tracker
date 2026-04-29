import { getDb } from '@/lib/db';
import type { AccessRequest } from '@/types';
import { logActivity } from './activity';

type Row = {
  id: number; num: number; system: string; access_type: string; role_permissions: string;
  recommended_method: string; justification: string; owner_client: string | null;
  status: string; provisioned_date: string | Date | null; notes: string | null;
  updated_at: string | Date;
};

function dateOnly(v: string | Date | null): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

function toItem(r: Row): AccessRequest {
  return {
    id: Number(r.id), num: Number(r.num), system: r.system, accessType: r.access_type,
    rolePermissions: r.role_permissions, recommendedMethod: r.recommended_method,
    justification: r.justification, ownerClient: r.owner_client,
    status: r.status as AccessRequest['status'],
    provisionedDate: dateOnly(r.provisioned_date),
    notes: r.notes,
    updatedAt: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function listAccess(): Promise<AccessRequest[]> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM access_requests ORDER BY num');
  return r.rows.map(toItem);
}

const COLS: Record<string, string> = {
  status: 'status', ownerClient: 'owner_client', provisionedDate: 'provisioned_date',
  notes: 'notes', accessType: 'access_type', rolePermissions: 'role_permissions',
  recommendedMethod: 'recommended_method', justification: 'justification', system: 'system',
};
const DATE_COLS = new Set(['provisioned_date']);

export async function updateAccess(id: number, patch: Record<string, unknown>, userId: number | null = null): Promise<AccessRequest> {
  const db = await getDb();
  const existing = (await db.query<Row>('SELECT * FROM access_requests WHERE id = $1', [id])).rows[0];
  if (!existing) throw new Error('not found');

  await db.withTx(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      const col = COLS[k]; if (!col) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[col];
      const newVal = (v === null || v === undefined || v === '') ? null
        : DATE_COLS.has(col) ? String(v).slice(0, 10) : String(v);
      const oldStr = oldVal === null || oldVal === undefined ? null
        : DATE_COLS.has(col) ? dateOnly(oldVal as string | Date)
        : String(oldVal);
      if (oldStr === newVal) continue;
      const cast = DATE_COLS.has(col) ? '::date' : '';
      await tx.query(
        `UPDATE access_requests SET ${col} = $1${cast}, updated_at = NOW() WHERE id = $2`,
        [newVal, id]
      );
      await logActivity('access', id, k, oldStr, newVal, userId, tx);
    }
  });

  const fresh = (await db.query<Row>('SELECT * FROM access_requests WHERE id = $1', [id])).rows[0];
  return toItem(fresh);
}
