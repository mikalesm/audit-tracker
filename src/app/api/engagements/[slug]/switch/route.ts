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

  const m = await getMembership(eng.id, actor.userId);
  if (!m && actor.systemRole !== 'platform_admin') {
    return NextResponse.json({ error: 'not a member of this engagement' }, { status: 403 });
  }

  cookies().set(ENGAGEMENT_COOKIE, eng.slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Session cookie (no maxAge): expires when browser closes.
  });
  return NextResponse.json({ ok: true, engagement: eng, role: m?.role ?? null });
}

/** DELETE — clear the engagement cookie (switch away). */
export async function DELETE() {
  cookies().delete(ENGAGEMENT_COOKIE);
  return NextResponse.json({ ok: true });
}
