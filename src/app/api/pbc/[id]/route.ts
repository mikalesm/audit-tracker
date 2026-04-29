import { NextRequest, NextResponse } from 'next/server';
import { getPBC, updatePBC } from '@/lib/repository/pbc';
import { getActor } from '@/lib/rbac';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const item = await getPBC(parseInt(ctx.params.id, 10));
  if (!item) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  const body = await req.json();
  const updated = await updatePBC(parseInt(ctx.params.id, 10), body, actor?.userId ?? null);
  return NextResponse.json(updated);
}
