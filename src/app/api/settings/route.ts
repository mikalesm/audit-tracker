import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/repository/settings';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await getSettings(actor.engagement!.id));
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return NextResponse.json(await updateSettings(actor.engagement!.id, body));
}
