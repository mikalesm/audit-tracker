import { NextRequest, NextResponse } from 'next/server';
import { listEvidence, saveEvidence } from '@/lib/repository/evidence';
import { getActor, requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { itemId: string } }) {
  return NextResponse.json(await listEvidence(parseInt(ctx.params.itemId, 10)));
}

export async function POST(req: NextRequest, ctx: { params: { itemId: string } }) {
  // Any authenticated user with at least client_owner can upload evidence.
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const itemId = parseInt(ctx.params.itemId, 10);
  const formData = await req.formData();
  const saved: unknown[] = [];
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      const buf = Buffer.from(await value.arrayBuffer());
      saved.push(await saveEvidence(itemId, value.name, buf, value.type, actor.userId));
    }
  }
  return NextResponse.json(saved);
}
