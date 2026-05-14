import { NextResponse } from 'next/server';
import { listWalkthroughs } from '@/lib/repository/walkthroughs';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await listWalkthroughs(actor.engagement!.id))
  );
}
