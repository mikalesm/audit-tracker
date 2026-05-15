import { NextRequest, NextResponse } from 'next/server';
import { updatePBCNote, deletePBCNote } from '@/lib/repository/pbc-notes';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

/** PATCH — edit a note. Author only. */
export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string; noteId: string } },
) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const noteId = parseInt(ctx.params.noteId, 10);
  let body: { body?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const text = String(body.body || '').trim();
  if (!text) return NextResponse.json({ error: 'body is required' }, { status: 400 });
  return withEngagement(actor.engagement!.id, async () => {
    const result = await updatePBCNote(actor.engagement!.id, noteId, actor.userId, text);
    if ('error' in result) {
      const status = result.error === 'not_found' ? 404 : 403;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  });
}

/** DELETE — remove a note. Author or auditor_lead only. */
export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string; noteId: string } },
) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const noteId = parseInt(ctx.params.noteId, 10);
  return withEngagement(actor.engagement!.id, async () => {
    const result = await deletePBCNote(
      actor.engagement!.id,
      noteId,
      actor.userId,
      actor.role === 'auditor_lead',
    );
    if ('error' in result) {
      const status = result.error === 'not_found' ? 404 : 403;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  });
}
