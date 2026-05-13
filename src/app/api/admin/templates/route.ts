import { NextResponse } from 'next/server';
import { listAllEngagementsWithCounts, listTemplates } from '@/lib/repository/engagements';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET — list templates. Defaults to a lightweight list (id, slug, name, item
 * count) suitable for the "Use template" dropdown on /engagements/new.
 *
 * Query: ?withCounts=1 → include member + item counts (for the admin table).
 */
export async function GET(req: Request) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;

  const url = new URL(req.url);
  if (url.searchParams.get('withCounts') === '1') {
    return NextResponse.json(await listAllEngagementsWithCounts({ kind: 'template' }));
  }
  return NextResponse.json(await listTemplates());
}
