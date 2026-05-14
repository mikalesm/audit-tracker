import { NextRequest, NextResponse } from 'next/server';
import { updateSampling } from '@/lib/repository/sampling';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(
      await updateSampling(actor.engagement!.id, parseInt(ctx.params.id, 10), body, actor.userId)
    )
  );
}
