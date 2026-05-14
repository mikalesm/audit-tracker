import { NextRequest, NextResponse } from 'next/server';
import { updateEntity, deleteEntity } from '@/lib/repository/entities';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(
      await updateEntity(actor.engagement!.id, parseInt(ctx.params.id, 10), body, actor.userId)
    )
  );
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () => {
    await deleteEntity(actor.engagement!.id, parseInt(ctx.params.id, 10), actor.userId);
    return NextResponse.json({ ok: true });
  });
}
