import { NextResponse } from 'next/server';
import { listAccess } from '@/lib/repository/access';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listAccess(actor.engagement!.id));
}
