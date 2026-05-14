import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/repository/settings';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await getSettings(actor.engagement!.id))
  );
}

export async function PATCH(req: NextRequest) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await updateSettings(actor.engagement!.id, body))
  );
}
