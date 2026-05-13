import { getDb } from '@/lib/db';
import type { Role } from '@/lib/repository/users';

export type EngagementStatus = 'active' | 'closed' | 'archived';

export interface Engagement {
  id: number;
  slug: string;
  name: string;
  clientName: string;
  fiscalYear: string | null;
  description: string | null;
  status: EngagementStatus;
  createdAt: string;
  createdById: number | null;
}

export interface Membership {
  id: number;
  engagementId: number;
  userId: number;
  role: Role;
  addedAt: string;
}

export interface EngagementForUser extends Engagement {
  role: Role;
}

type EngagementRow = {
  id: number; slug: string; name: string; client_name: string;
  fiscal_year: string | null; description: string | null;
  status: string; created_at: string | Date; created_by_id: number | null;
};

function toEngagement(r: EngagementRow): Engagement {
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    clientName: r.client_name,
    fiscalYear: r.fiscal_year,
    description: r.description,
    status: r.status as EngagementStatus,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    createdById: r.created_by_id === null ? null : Number(r.created_by_id),
  };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export async function listEngagements(): Promise<Engagement[]> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements ORDER BY status, created_at DESC'
  );
  return r.rows.map(toEngagement);
}

export async function getEngagementBySlug(slug: string): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements WHERE slug = $1',
    [slug]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
}

export async function getEngagementById(id: number): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements WHERE id = $1',
    [id]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
}

export interface CreateEngagementInput {
  slug: string;
  name: string;
  clientName: string;
  fiscalYear?: string | null;
  description?: string | null;
  createdById: number;
}

/**
 * Create a new engagement and add the creator as its auditor_lead.
 * Also seeds the default settings rows so the engagement renders.
 */
export async function createEngagement(input: CreateEngagementInput): Promise<Engagement> {
  if (!isValidSlug(input.slug)) {
    throw new Error('invalid slug: lowercase letters, digits, hyphens; 3-32 chars; cannot start or end with -');
  }
  const db = await getDb();
  return db.withTx(async (tx) => {
    const r = await tx.query<EngagementRow>(
      `INSERT INTO engagements (slug, name, client_name, fiscal_year, description, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.slug, input.name, input.clientName,
        input.fiscalYear ?? null, input.description ?? null, input.createdById,
      ]
    );
    const eng = toEngagement(r.rows[0]);
    await tx.query(
      `INSERT INTO engagement_memberships (engagement_id, user_id, role)
       VALUES ($1, $2, 'auditor_lead')`,
      [eng.id, input.createdById]
    );
    // Seed default settings rows so /settings renders out of the box.
    await tx.query(
      `INSERT INTO settings (engagement_id, key, value) VALUES
        ($1, 'clientName',   $2),
        ($1, 'auditPeriod',  $3),
        ($1, 'leadAuditor',  ''),
        ($1, 'sponsor',      ''),
        ($1, 'projectTitle', $4)
       ON CONFLICT DO NOTHING`,
      [eng.id, eng.clientName, eng.fiscalYear ?? '', eng.name]
    );
    return eng;
  });
}

// ---- memberships ----

type MembershipRow = {
  id: number; engagement_id: number; user_id: number; role: string;
  added_at: string | Date;
};

function toMembership(r: MembershipRow): Membership {
  return {
    id: Number(r.id),
    engagementId: Number(r.engagement_id),
    userId: Number(r.user_id),
    role: r.role as Role,
    addedAt: r.added_at instanceof Date ? r.added_at.toISOString() : String(r.added_at),
  };
}

export async function listEngagementsForUser(userId: number): Promise<EngagementForUser[]> {
  const db = await getDb();
  const r = await db.query<EngagementRow & { role: string }>(
    `SELECT e.*, m.role
       FROM engagements e
       JOIN engagement_memberships m ON m.engagement_id = e.id
      WHERE m.user_id = $1
      ORDER BY e.status, e.created_at DESC`,
    [userId]
  );
  return r.rows.map((row) => ({ ...toEngagement(row), role: row.role as Role }));
}

export async function getMembership(
  engagementId: number,
  userId: number,
): Promise<Membership | null> {
  const db = await getDb();
  const r = await db.query<MembershipRow>(
    'SELECT * FROM engagement_memberships WHERE engagement_id = $1 AND user_id = $2',
    [engagementId, userId]
  );
  return r.rows[0] ? toMembership(r.rows[0]) : null;
}

export async function listEngagementMembers(
  engagementId: number,
): Promise<Array<Membership & { email: string; displayName: string | null }>> {
  const db = await getDb();
  const r = await db.query<MembershipRow & { email: string; display_name: string | null }>(
    `SELECT m.*, u.email, u.display_name
       FROM engagement_memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.engagement_id = $1
      ORDER BY u.email`,
    [engagementId]
  );
  return r.rows.map((row) => ({
    ...toMembership(row),
    email: row.email,
    displayName: row.display_name,
  }));
}

export async function upsertMembership(
  engagementId: number,
  userId: number,
  role: Role,
): Promise<Membership> {
  const db = await getDb();
  const r = await db.query<MembershipRow>(
    `INSERT INTO engagement_memberships (engagement_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (engagement_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [engagementId, userId, role]
  );
  return toMembership(r.rows[0]);
}

export async function removeMembership(
  engagementId: number,
  userId: number,
): Promise<void> {
  const db = await getDb();
  await db.query(
    'DELETE FROM engagement_memberships WHERE engagement_id = $1 AND user_id = $2',
    [engagementId, userId]
  );
}
