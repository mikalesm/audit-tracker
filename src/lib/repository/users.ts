import { getDb } from '@/lib/db';

export type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export const ROLES: readonly Role[] = ['auditor_lead', 'auditor', 'client_owner', 'client_reviewer'];

export interface AppUser {
  id: number;
  entraObjectId: string;
  email: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

type Row = {
  id: number; entra_object_id: string; email: string; display_name: string | null;
  role: string; is_active: boolean; created_at: string | Date; last_seen_at: string | Date | null;
};

function toUser(r: Row): AppUser {
  return {
    id: Number(r.id),
    entraObjectId: r.entra_object_id,
    email: r.email,
    displayName: r.display_name,
    role: r.role as Role,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    lastSeenAt: r.last_seen_at === null ? null
      : r.last_seen_at instanceof Date ? r.last_seen_at.toISOString() : String(r.last_seen_at),
  };
}

/**
 * Upsert a user on sign-in, bumping last_seen_at. The first user ever to sign in
 * is promoted to auditor_lead so the engagement isn't bricked with no admin.
 */
export async function upsertUserOnSignIn(
  entraObjectId: string,
  email: string,
  displayName: string | null,
): Promise<AppUser> {
  const db = await getDb();
  return db.withTx(async (tx) => {
    const existing = (await tx.query<Row>(
      'SELECT * FROM users WHERE entra_object_id = $1',
      [entraObjectId]
    )).rows[0];

    if (existing) {
      await tx.query(
        `UPDATE users SET email = $2, display_name = $3, last_seen_at = NOW() WHERE id = $1`,
        [existing.id, email, displayName]
      );
      const r = (await tx.query<Row>('SELECT * FROM users WHERE id = $1', [existing.id])).rows[0];
      return toUser(r);
    }

    const userCount = Number((await tx.query<{ c: number }>('SELECT COUNT(*)::int AS c FROM users')).rows[0].c);
    const initialRole: Role = userCount === 0 ? 'auditor_lead' : 'client_reviewer';

    const r = (await tx.query<Row>(
      `INSERT INTO users (entra_object_id, email, display_name, role, last_seen_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [entraObjectId, email, displayName, initialRole]
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
