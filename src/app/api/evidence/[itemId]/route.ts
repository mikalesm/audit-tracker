import { NextRequest, NextResponse } from 'next/server';
import { listEvidence, saveEvidence } from '@/lib/repository/evidence';
import { getPBC, updatePBC } from '@/lib/repository/pbc';
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
  const isClient = actor.role === 'client_owner' || actor.role === 'client_reviewer';
  return withEngagement(actor.engagement!.id, async () => {
    const saved: unknown[] = [];
    for (const [, value] of formData.entries()) {
      if (value instanceof File) {
        const buf = Buffer.from(await value.arrayBuffer());
        saved.push(await saveEvidence(actor.engagement!.id, itemId, value.name, buf, value.type, actor.userId));
      }
    }
    // When the client uploads, nudge the workflow forward: claim ownership if
    // it's still unassigned, and move the status off the "nothing's happening
    // yet" states into In Progress so the auditor sees the activity.
    if (isClient && saved.length > 0) {
      const item = await getPBC(actor.engagement!.id, itemId);
      if (item) {
        const patch: Record<string, unknown> = {};
        if (!item.ownerClient || !item.ownerClient.trim()) {
          patch.ownerClient = actor.email;
        }
        if (item.status === 'Not Started' || item.status === 'Requested') {
          patch.status = 'In Progress';
        }
        if (Object.keys(patch).length > 0) {
          await updatePBC(actor.engagement!.id, itemId, patch, actor.userId);
        }
      }
    }
    return NextResponse.json(saved);
  });
}
