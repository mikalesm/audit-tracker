import { NextResponse } from 'next/server';
import { listEntities, addEntity } from '@/lib/repository/entities';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await listEntities(actor.engagement!.id))
  );
}

export async function POST() {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await addEntity(actor.engagement!.id, actor.userId))
  );
}
