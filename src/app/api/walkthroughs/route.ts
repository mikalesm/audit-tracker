import { NextRequest, NextResponse } from 'next/server';
import { listWalkthroughs, createWalkthrough } from '@/lib/repository/walkthroughs';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await listWalkthroughs(actor.engagement!.id))
  );
}

export async function POST(req: NextRequest) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  return withEngagement(actor.engagement!.id, async () => {
    try {
      const item = await createWalkthrough(actor.engagement!.id, body, actor.userId);
      return NextResponse.json(item, { status: 201 });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  });
}
