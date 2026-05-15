import { NextRequest, NextResponse } from 'next/server';
import { listPBCNotes, addPBCNote } from '@/lib/repository/pbc-notes';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const itemId = parseInt(ctx.params.id, 10);
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await listPBCNotes(actor.engagement!.id, itemId))
  );
}

/** POST — add a note. Viewers (client_reviewer) can read but not write. */
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const itemId = parseInt(ctx.params.id, 10);
  let body: { body?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const text = String(body.body || '').trim();
  if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 });
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await addPBCNote(actor.engagement!.id, itemId, actor.userId, text))
  );
}
