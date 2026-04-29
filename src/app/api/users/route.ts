import { NextResponse } from 'next/server';
import { listUsers } from '@/lib/repository/users';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listUsers());
}
