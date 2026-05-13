import { getDb } from '@/lib/db';

export type Role = 'auditor_lead' | 'auditor' | 'client_owner' | 'client_reviewer';

export const ROLES: readonly Role[] = ['auditor_lead', 'auditor', 'client_owner', 'client_reviewer'];

export type SystemRole = 'platform_admin' | 'member';

export interface AppUser {
  id: number;
  entraObjectId: string;
  email: string;
  displayName: string | null;
  upn: string | null;
  /** Legacy global role — retained for backwards compat; new code uses memberships. */
  role: Role;
  systemRole: SystemRole;
  isActive: boolean;
  createdAt: string;
  lastSeenAt: string | null;
}

type Row = {
  id: number; entra_object_id: string; email: string; display_name: string | null;
  upn: string | null;
  role: string; system_role: string | null;
  is_active: boolean; created_at: string | Date; last_seen_at: string | Date | null;
};

function toUser(r: Row): AppUser {
  return {
    id: Number(r.id),
    entraObjectId: r.entra_object_id,
    email: r.email,
    displayName: r.display_name,
    upn: r.upn ?? null,
    role: r.role as Role,
    systemRole: (r.system_role === 'platform_admin' ? 'platform_admin' : 'member') as SystemRole,
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
 * If AUDITOR_LEAD_BOOTSTRAP_EMAILS lists this email, system_role is promoted
 * to 'platform_admin' on insert AND on subsequent sign-ins (idempotent). The
 * per-engagement role lives on engagement_memberships and is unrelated to
 * this column.
 */
export async function upsertUserOnSignIn(
  entraObjectId: string,
  email: string,
  displayName: string | null,
  upn: string | null = null,
): Promise<AppUser> {
  const db = await getDb();
  return db.withTx(async (tx) => {
    const allowed = bootstrapLeadEmails();
    const emailLc = (email || '').toLowerCase();
    const wantsPlatformAdmin = allowed.has(emailLc);

    const existing = (await tx.query<Row>(
      'SELECT * FROM users WHERE entra_object_id = $1',
      [entraObjectId]
    )).rows[0];

    if (existing) {
      // Re-evaluate platform_admin on every sign-in: if your email is in the
      // bootstrap list and you're not platform_admin yet, get promoted now.
      const newlyPromoted = wantsPlatformAdmin && existing.system_role !== 'platform_admin';
      const newSystemRole = newlyPromoted ? 'platform_admin' : existing.system_role;
      await tx.query(
        `UPDATE users SET email = $2, display_name = $3, upn = COALESCE($4, upn),
          system_role = $5, last_seen_at = NOW() WHERE id = $1`,
        [existing.id, email, displayName, upn, newSystemRole]
      );
      if (newlyPromoted) {
        // Same bootstrap convenience as below: a freshly-promoted platform
        // admin becomes auditor_lead on every engagement that has no lead.
        await tx.query(
          `INSERT INTO engagement_memberships (engagement_id, user_id, role)
           SELECT e.id, $1, 'auditor_lead'
             FROM engagements e
            WHERE NOT EXISTS (
              SELECT 1 FROM engagement_memberships m
               WHERE m.engagement_id = e.id AND m.role = 'auditor_lead'
            )
            ON CONFLICT (engagement_id, user_id) DO NOTHING`,
          [existing.id]
        );
      }
      const r = (await tx.query<Row>('SELECT * FROM users WHERE id = $1', [existing.id])).rows[0];
      return toUser(r);
    }

    const systemRole: SystemRole = wantsPlatformAdmin ? 'platform_admin' : 'member';
    // Legacy `role` column is no longer load-bearing but retained NOT NULL by
    // the old migration; default it to client_reviewer to satisfy the constraint.
    const r = (await tx.query<Row>(
      `INSERT INTO users (entra_object_id, email, display_name, upn, role, system_role, last_seen_at)
       VALUES ($1, $2, $3, $4, 'client_reviewer', $5, NOW())
       RETURNING *`,
      [entraObjectId, email, displayName, upn, systemRole]
    )).rows[0];

    // Bootstrap convenience: a brand-new platform_admin is auto-added as
    // auditor_lead to any engagement that has no auditor_lead yet. Without
    // this, the very first platform admin would sign in and see an empty
    // engagement list even though pre-seeded engagements exist.
    if (systemRole === 'platform_admin') {
      await tx.query(
        `INSERT INTO engagement_memberships (engagement_id, user_id, role)
         SELECT e.id, $1, 'auditor_lead'
           FROM engagements e
          WHERE NOT EXISTS (
            SELECT 1 FROM engagement_memberships m
             WHERE m.engagement_id = e.id AND m.role = 'auditor_lead'
          )
          ON CONFLICT (engagement_id, user_id) DO NOTHING`,
        [Number(r.id)]
      );
    }

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
  engagementId: number,
  userId: number,
  resourceType: string,
  resourceId: number | null,
  action: string,
  ipAddress: string | null,
  userAgent: string | null,
): Promise<void> {
  const db = await getDb();
  await db.query(
    `INSERT INTO access_log (engagement_id, user_id, resource_type, resource_id, action, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6::inet, $7)`,
    [engagementId, userId, resourceType, resourceId, action, ipAddress, userAgent]
  );
}
