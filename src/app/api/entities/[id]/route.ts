import { NextRequest, NextResponse } from 'next/server';
import { updateEntity, deleteEntity } from '@/lib/repository/entities';
import { getActor } from '@/lib/rbac';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  const body = await req.json();
  return NextResponse.json(await updateEntity(parseInt(ctx.params.id, 10), body, actor?.userId ?? null));
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  await deleteEntity(parseInt(ctx.params.id, 10), actor?.userId ?? null);
  return NextResponse.json({ ok: true });
}
