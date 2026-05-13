import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementBySlug,
  listEngagementMembers,
  upsertMembership,
  removeMembership,
  getMembership,
} from '@/lib/repository/engagements';
import { getDb } from '@/lib/db';
import { requireAuth, isErrorResponse, hasRole, type Role } from '@/lib/rbac';
import { ROLES, type Role as UserRole } from '@/lib/repository/users';

export const dynamic = 'force-dynamic';

async function findOrCreatePlaceholderUser(email: string): Promise<{ id: number } | null> {
  const db = await getDb();
  // Match existing by case-insensitive email.
  const existing = (await db.query<{ id: number }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email]
  )).rows[0];
  if (existing) return { id: Number(existing.id) };

  // Pre-provision a placeholder row. The user's Entra OID is filled in when
  // they first sign in (upsertUserOnSignIn matches by entra_object_id and
  // updates the existing row by email). Until then, the placeholder is a
  // "pending invite" — has no Entra OID, can't sign in, but can be assigned
  // a membership in advance.
  const placeholder = (await db.query<{ id: number }>(
    `INSERT INTO users (entra_object_id, email, display_name, role, system_role)
     VALUES ($1, $2, $3, 'client_reviewer', 'member')
     RETURNING id`,
    [`pending::${email.toLowerCase()}`, email, email]
  )).rows[0];
  return { id: Number(placeholder.id) };
}

/** GET — list members of an engagement. Any member can list. */
export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;
  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  const myMembership = await getMembership(eng.id, actor.userId);
  if (!myMembership && actor.systemRole !== 'platform_admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const members = await listEngagementMembers(eng.id);
  return NextResponse.json(members);
}

/**
 * POST — add a new member (by email) with a role. Auditor lead or platform_admin only.
 * Body: { email: string, role: Role }
 */
export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;
  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  if (actor.systemRole !== 'platform_admin') {
    const m = await getMembership(eng.id, actor.userId);
    if (!m || !hasRole(m.role as Role, 'auditor_lead')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  let body: { email?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const email = String(body.email || '').trim();
  const role = String(body.role || '');
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
  if (!ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'invalid role', validRoles: ROLES }, { status: 400 });
  }

  const target = await findOrCreatePlaceholderUser(email);
  if (!target) return NextResponse.json({ error: 'could not resolve user' }, { status: 500 });

  const membership = await upsertMembership(eng.id, target.id, role as UserRole);
  return NextResponse.json({ membership, email });
}

/**
 * PATCH — change an existing member's role.
 * Body: { userId: number, role: Role }
 */
export async function PATCH(req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;
  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  if (actor.systemRole !== 'platform_admin') {
    const m = await getMembership(eng.id, actor.userId);
    if (!m || !hasRole(m.role as Role, 'auditor_lead')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  let body: { userId?: number; role?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const userId = Number(body.userId);
  const role = String(body.role || '');
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  if (!ROLES.includes(role as UserRole)) {
    return NextResponse.json({ error: 'invalid role', validRoles: ROLES }, { status: 400 });
  }
  const membership = await upsertMembership(eng.id, userId, role as UserRole);
  return NextResponse.json(membership);
}

/**
 * DELETE — remove a member.
 * Body: { userId: number }
 */
export async function DELETE(req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;
  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  if (actor.systemRole !== 'platform_admin') {
    const m = await getMembership(eng.id, actor.userId);
    if (!m || !hasRole(m.role as Role, 'auditor_lead')) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }
  let body: { userId?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  const userId = Number(body.userId);
  if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  // Refuse to remove yourself if you'd leave the engagement without an auditor_lead.
  if (userId === actor.userId) {
    const db = await getDb();
    const { rows } = await db.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM engagement_memberships
        WHERE engagement_id = $1 AND role = 'auditor_lead' AND user_id <> $2`,
      [eng.id, actor.userId]
    );
    if (Number(rows[0]?.c ?? 0) === 0) {
      return NextResponse.json({ error: 'cannot remove the last auditor_lead' }, { status: 400 });
    }
  }
  await removeMembership(eng.id, userId);
  return NextResponse.json({ ok: true });
}
