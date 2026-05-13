import { NextResponse } from 'next/server';
import { listEntities, addEntity } from '@/lib/repository/entities';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listEntities(actor.engagement!.id));
}

export async function POST() {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await addEntity(actor.engagement!.id, actor.userId));
}
