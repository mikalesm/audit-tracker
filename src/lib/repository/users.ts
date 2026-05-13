import { getDb } from '@/lib/db';

export type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export const ROLES: readonly Role[] = ['auditor_lead', 'auditor', 'client_owner', 'client_reviewer'];

export interface AppUser {
  id: number;
  entraObjectId: string;
  email: string;
  displayName: string | null;
  upn: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

type Row = {
  id: number; entra_object_id: string; email: string; display_name: string | null;
  upn: string | null;
  role: string; is_active: boolean; created_at: string | Date; last_seen_at: string | Date | null;
};

function toUser(r: Row): AppUser {
  return {
    id: Number(r.id),
    entraObjectId: r.entra_object_id,
    email: r.email,
    displayName: r.display_name,
    upn: r.upn ?? null,
    role: r.role as Role,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    lastSeenAt: r.last_seen_at === null ? null
      : r.last_seen_at instanceof Date ? r.last_seen_at.toISOString() : String(r.last_seen_at),
  };
}

function bootstrapLeadEmails(): Set<string> {
  const raw = process.env.AUDITOR_LEAD_BOOTSTRAP_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Upsert a user on sign-in, bumping last_seen_at.
 *
 * Initial role policy:
 *   - If AUDITOR_LEAD_BOOTSTRAP_EMAILS lists this email and no auditor_lead
 *     exists yet, promote to auditor_lead.
 *   - Otherwise default to client_reviewer.
 *
 * This deliberately removes the old "first user wins" rule, which let a B2B
 * guest who clicked their invite first become the engagement lead.
 */
export async function upsertUserOnSignIn(
  entraObjectId: string,
  email: string,
  displayName: string | null,
  upn: string | null = null,
): Promise<AppUser> {
  const db = await getDb();
  return db.withTx(async (tx) => {
    const existing = (await tx.query<Row>(
      'SELECT * FROM users WHERE entra_object_id = $1',
      [entraObjectId]
    )).rows[0];

    if (existing) {
      await tx.query(
        `UPDATE users SET email = $2, display_name = $3, upn = COALESCE($4, upn), last_seen_at = NOW() WHERE id = $1`,
        [existing.id, email, displayName, upn]
      );
      const r = (await tx.query<Row>('SELECT * FROM users WHERE id = $1', [existing.id])).rows[0];
      return toUser(r);
    }

    const allowed = bootstrapLeadEmails();
    const emailLc = (email || '').toLowerCase();
    let initialRole: Role = 'client_reviewer';
    if (allowed.has(emailLc)) {
      const { rows } = await tx.query<{ c: number }>(
        `SELECT COUNT(*)::int AS c FROM users WHERE role = 'auditor_lead'`
      );
      if (Number(rows[0].c) === 0) initialRole = 'auditor_lead';
    }

    const r = (await tx.query<Row>(
      `INSERT INTO users (entra_object_id, email, display_name, upn, role, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [entraObjectId, email, displayName, upn, initialRole]
    )).rows[0];
    return toUser(r);
  });
}

export async function getUserByEntraId(entraObjectId: string): Promise<AppUser | null> {
  const db = await getDb();
  const r = (await db.query<Row>('SELECT * FROM users WHERE entra_object_id = $1', [entraObjectId])).rows[0];
  return r ? toUser(r) : null;
}

export async function listUsers(): Promise<AppUser[]> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM users ORDER BY created_at DESC');
  return r.rows.map(toUser);
}

export async function setUserRole(id: number, role: Role): Promise<AppUser> {
  if (!ROLES.includes(role)) throw new Error('invalid role');
  const db = await getDb();
  await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
  const r = (await db.query<Row>('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  return toUser(r);
}

export async function setUserActive(id: number, isActive: boolean): Promise<AppUser> {
  const db = await getDb();
  await db.query('UPDATE users SET is_active = $1 WHERE id = $2', [isActive, id]);
  const r = (await db.query<Row>('SELECT * FROM users WHERE id = $1', [id])).rows[0];
  return toUser(r);
}

export async function logAccess(
  userId: number,
  resourceType: string,
  resourceId: number | null,
  action: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO access_log (user_id, resource_type, resource_id, action, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5::inet, $6)`,
    [userId, resourceType, resourceId, action, ipAddress, userAgent]
  );
}
