import { NextRequest, NextResponse } from 'next/server';
import {
  getEngagementBySlug,
  setEngagementStatus,
  upsertMembership,
  deleteEngagement,
  resetEngagementState,
  type EngagementStatus,
} from '@/lib/repository/engagements';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

const VALID_STATUSES: EngagementStatus[] = ['active', 'closed', 'archived'];

export async function PATCH(req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;
  const eng = await getEngagementBySlug(ctx.params.slug);
  if (!eng) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });

  let body: { status?: string; joinAs?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  // Two distinct operations: change status OR join self as a member.
  if (body.joinAs) {
    if (body.joinAs !== 'auditor_lead' && body.joinAs !== 'auditor') {
      return NextResponse.json({ error: 'joinAs must be auditor_lead or auditor' }, { status: 400 });
    }
    const m = await upsertMembership(eng.id, actor.userId, body.joinAs);
    return NextResponse.json({ ok: true, joined: true, membership: m });
  }

  if (body.status) {
    if (!VALID_STATUSES.includes(body.status as EngagementStatus)) {
      return NextResponse.json({ error: 'invalid status', valid: VALID_STATUSES }, { status: 400 });
    }
    const updated = await setEngagementStatus(eng.slug, body.status as EngagementStatus);
    return NextResponse.json({ ok: true, engagement: updated });
  }

  return NextResponse.json({ error: 'no-op: provide status or joinAs' }, { status: 400 });
}

/**
 * DELETE — permanently remove an engagement (or template) and every row
 * scoped to it. Platform-admin only. The deletion is destructive and
 * unrecoverable — the UI confirms with the engagement's name first.
 */
export async function DELETE(_req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;
  const result = await deleteEngagement(ctx.params.slug);
  if (!result) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });
  return NextResponse.json({ ok: true, deleted: result });
}

/**
 * POST { action: "reset", confirm: <slug> } — wipe history, evidence, and notes
 * for an engagement and return its PBC/access/walkthrough/sampling rows to
 * their seeded defaults. The structure (titles, categories, library template
 * links) is preserved. Platform-admin only; `confirm` must echo the slug to
 * make accidental triggers from a misclick impossible.
 */
export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;
  let body: { action?: string; confirm?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }
  if (body.action !== 'reset') {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }
  if (body.confirm !== ctx.params.slug) {
    return NextResponse.json({ error: 'confirm must equal the engagement slug' }, { status: 400 });
  }
  const result = await resetEngagementState(ctx.params.slug);
  if (!result) return NextResponse.json({ error: 'engagement not found' }, { status: 404 });
  return NextResponse.json({ ok: true, reset: result });
}
