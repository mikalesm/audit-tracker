import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getEngagementBySlug, getMembership } from '@/lib/repository/engagements';
import { requireAuth, isErrorResponse, ENGAGEMENT_COOKIE } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/** POST — set the engagement cookie after verifying membership. */
export async function POST(_req: Request, ctx: { params: { slug: string } }) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;

  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  // Strict isolation: every user (including platform_admin) must be an explicit
  // member of an engagement to switch into it. Platform admins still see the
  // engagement on the admin page and can add themselves as auditor_lead from
  // /admin/engagements; they cannot peek into data without an explicit role.
  const m = await getMembership(eng.id, actor.userId);
  if (!m) {
    return NextResponse.json({ error: 'not a member of this engagement' }, { status: 403 });
  }

  cookies().set(ENGAGEMENT_COOKIE, eng.slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return NextResponse.json({ ok: true, engagement: eng, role: m.role });
}

/** DELETE — clear the engagement cookie (switch away). */
export async function DELETE() {
  cookies().delete(ENGAGEMENT_COOKIE);
  return NextResponse.json({ ok: true });
}
