import { NextRequest, NextResponse } from 'next/server';
import {
  listEngagementsForUser,
  createEngagement,
  isValidSlug,
  getEngagementBySlug,
} from '@/lib/repository/engagements';
import { requireAuth, requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';
import { evidenceContainerFor } from '@/lib/blob';
import { isValidCategory, type LibrarySelection, type PBCCategory } from '@/lib/templates/library';

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

  let body: {
    slug?: string; name?: string; clientName?: string;
    fiscalYear?: string; description?: string;
    isTemplate?: boolean; fromTemplateSlug?: string;
    librarySeed?: Partial<LibrarySelection> & { pbcCategories?: unknown };
    allowEmpty?: boolean;
  };
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
  const isTemplate = body.isTemplate === true;
  const allowEmpty = body.allowEmpty === true;

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

  if (body.fromTemplateSlug && body.librarySeed) {
    return NextResponse.json({ error: 'fromTemplateSlug and librarySeed are mutually exclusive' }, { status: 400 });
  }

  // Resolve template if provided. Templates seed the new engagement with the
  // standard PBC/access/walkthroughs/entities/sampling rows (per-client fields
  // reset to defaults).
  let fromTemplateId: number | null = null;
  if (body.fromTemplateSlug) {
    const t = await getEngagementBySlug(String(body.fromTemplateSlug));
    if (!t || !t.isTemplate) {
      return NextResponse.json({ error: `template '${body.fromTemplateSlug}' not found` }, { status: 400 });
    }
    fromTemplateId = t.id;
  }

  // Validate librarySeed if provided.
  let librarySeed: LibrarySelection | null = null;
  if (body.librarySeed) {
    const raw = body.librarySeed;
    if (!Array.isArray(raw.pbcCategories)) {
      return NextResponse.json({ error: 'librarySeed.pbcCategories must be an array' }, { status: 400 });
    }
    const cats: PBCCategory[] = [];
    for (const c of raw.pbcCategories) {
      if (!isValidCategory(c)) {
        return NextResponse.json({ error: `librarySeed.pbcCategories: unknown category '${String(c)}'` }, { status: 400 });
      }
      cats.push(c);
    }
    const flags = {
      includeAccess: raw.includeAccess === true,
      includeWalkthroughs: raw.includeWalkthroughs === true,
      includeEntities: raw.includeEntities === true,
      includeSampling: raw.includeSampling === true,
    };
    const anyContent =
      cats.length > 0 || flags.includeAccess || flags.includeWalkthroughs
      || flags.includeEntities || flags.includeSampling;
    if (!anyContent && !allowEmpty) {
      return NextResponse.json({
        error: 'librarySeed selects no content. Pass allowEmpty: true to create an empty engagement on purpose.',
      }, { status: 400 });
    }
    librarySeed = { pbcCategories: cats, ...flags };
  }

  const eng = await createEngagement({
    slug, name, clientName, fiscalYear, description,
    isTemplate, fromTemplateId, librarySeed,
    createdById: actor.userId,
  });

  // Pre-create the per-engagement blob container so the first evidence upload
  // doesn't fail. Non-fatal on error — Azurite can be flaky during dev.
  // Templates also get their own container; useful if the user wants to upload
  // an example evidence to the template.
  try {
    await evidenceContainerFor(eng.id);
  } catch (e) {
    console.error('[engagements:create] failed to pre-create blob container:', e);
  }

  return NextResponse.json(eng, { status: 201 });
}
