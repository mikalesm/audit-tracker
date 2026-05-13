import { NextRequest, NextResponse } from 'next/server';
import {
  listEngagementsForUser,
  createEngagement,
  isValidSlug,
  getEngagementBySlug,
} from '@/lib/repository/engagements';
import { requireAuth, requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';
import { evidenceContainerFor } from '@/lib/blob';

export const dynamic = 'force-dynamic';

/** GET — list engagements the actor is a member of. */
export async function GET() {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;
  const list = await listEngagementsForUser(actor.userId);
  return NextResponse.json({
    engagements: list,
    systemRole: actor.systemRole,
  });
}

/** POST — create a new engagement. Restricted to platform_admin. */
export async function POST(req: NextRequest) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;

  let body: { slug?: string; name?: string; clientName?: string; fiscalYear?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const slug = String(body.slug || '').toLowerCase().trim();
  const name = String(body.name || '').trim();
  const clientName = String(body.clientName || '').trim();
  const fiscalYear = body.fiscalYear ? String(body.fiscalYear).trim() : null;
  const description = body.description ? String(body.description).trim() : null;

  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json({ error: 'invalid slug — lowercase, alphanumeric and dashes, 3-32 chars' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!clientName) {
    return NextResponse.json({ error: 'clientName is required' }, { status: 400 });
  }
  if (await getEngagementBySlug(slug)) {
    return NextResponse.json({ error: `engagement '${slug}' already exists` }, { status: 409 });
  }

  const eng = await createEngagement({
    slug, name, clientName, fiscalYear, description,
    createdById: actor.userId,
  });

  // Pre-create the per-engagement blob container so the first evidence upload
  // doesn't fail. Non-fatal on error — Azurite can be flaky during dev.
  try {
    await evidenceContainerFor(eng.id);
  } catch (e) {
    console.error('[engagements:create] failed to pre-create blob container:', e);
  }

  return NextResponse.json(eng, { status: 201 });
}
