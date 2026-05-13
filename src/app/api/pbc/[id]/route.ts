import { NextRequest, NextResponse } from 'next/server';
import { getPBC, updatePBC } from '@/lib/repository/pbc';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const item = await getPBC(actor.engagement!.id, parseInt(ctx.params.id, 10));
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  const updated = await updatePBC(actor.engagement!.id, parseInt(ctx.params.id, 10), body, actor.userId);
  return NextResponse.json(updated);
}
