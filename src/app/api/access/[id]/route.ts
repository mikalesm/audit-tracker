import { NextRequest, NextResponse } from 'next/server';
import { updateAccess } from '@/lib/repository/access';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(
      await updateAccess(actor.engagement!.id, parseInt(ctx.params.id, 10), body, actor.userId)
    )
  );
}
