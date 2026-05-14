import { NextRequest, NextResponse } from 'next/server';
import { listEvidence, saveEvidence } from '@/lib/repository/evidence';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { itemId: string } }) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(
      await listEvidence(actor.engagement!.id, parseInt(ctx.params.itemId, 10))
    )
  );
}

export async function POST(req: NextRequest, ctx: { params: { itemId: string } }) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const itemId = parseInt(ctx.params.itemId, 10);
  const formData = await req.formData();
  return withEngagement(actor.engagement!.id, async () => {
    const saved: unknown[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const buf = Buffer.from(await value.arrayBuffer());
        saved.push(await saveEvidence(actor.engagement!.id, itemId, value.name, buf, value.type, actor.userId));
      }
    }
    return NextResponse.json(saved);
  });
}
