import { NextRequest, NextResponse } from 'next/server';
import { updateSampling } from '@/lib/repository/sampling';
import { getActor } from '@/lib/rbac';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  const body = await req.json();
  return NextResponse.json(await updateSampling(parseInt(ctx.params.id, 10), body, actor?.userId ?? null));
}
