import { NextRequest, NextResponse } from 'next/server';
import { engagementTimeline } from '@/lib/repository/activity';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  const limit = parseInt(req.nextUrl.searchParams.get('limit') || '500', 10);
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await engagementTimeline(actor.engagement!.id, limit))
  );
}
