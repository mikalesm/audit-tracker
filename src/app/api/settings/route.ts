import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/repository/settings';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getSettings());
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return NextResponse.json(await updateSettings(body));
}
