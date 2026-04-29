import { NextRequest, NextResponse } from 'next/server';
import { updateWalkthrough } from '@/lib/repository/walkthroughs';
import { getActor } from '@/lib/rbac';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  const body = await req.json();
  return NextResponse.json(await updateWalkthrough(parseInt(ctx.params.id, 10), body, actor?.userId ?? null));
}
