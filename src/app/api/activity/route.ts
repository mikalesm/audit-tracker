import { NextRequest, NextResponse } from 'next/server';
import { recentActivity, activityFor } from '@/lib/repository/activity';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const eid = actor.engagement!.id;
  const type = req.nextUrl.searchParams.get('type');
  const id = req.nextUrl.searchParams.get('id');
  return withEngagement(eid, async () => {
    if (type && id) {
      return NextResponse.json(await activityFor(eid, type, parseInt(id, 10)));
    }
    return NextResponse.json(await recentActivity(eid, 200));
  });
}
