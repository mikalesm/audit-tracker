import { NextRequest, NextResponse } from 'next/server';
import { deleteSavedView } from '@/lib/repository/savedViews';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  await deleteSavedView(actor.engagement!.id, parseInt(ctx.params.id, 10));
  return NextResponse.json({ ok: true });
}
