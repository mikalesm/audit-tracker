import { NextRequest, NextResponse } from 'next/server';
import { deleteEvidence, getEvidenceDownloadUrl } from '@/lib/repository/evidence';
import { getActor, requireRole, isErrorResponse } from '@/lib/rbac';
import { logAccess } from '@/lib/repository/users';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await getActor();
  const id = parseInt(ctx.params.id, 10);
  const info = await getEvidenceDownloadUrl(id);
  if (!info) return new NextResponse('Not found', { status: 404 });
  if (actor) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
    const ua = req.headers.get('user-agent');
    await logAccess(actor.userId, 'evidence', id, 'download', ip, ua);
  }
  return NextResponse.redirect(info.url, { status: 302 });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  await deleteEvidence(parseInt(ctx.params.id, 10), actor.userId);
  return NextResponse.json({ ok: true });
}
