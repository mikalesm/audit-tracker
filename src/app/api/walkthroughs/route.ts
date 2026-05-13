import { NextResponse } from 'next/server';
import { listWalkthroughs } from '@/lib/repository/walkthroughs';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listWalkthroughs(actor.engagement!.id));
}
