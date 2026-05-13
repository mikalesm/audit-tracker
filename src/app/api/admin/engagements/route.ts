import { NextResponse } from 'next/server';
import { listAllEngagementsWithCounts } from '@/lib/repository/engagements';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listAllEngagementsWithCounts());
}
