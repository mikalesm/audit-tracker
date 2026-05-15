import { NextRequest, NextResponse } from 'next/server';
import { deleteEvidence, getEvidenceForDownload } from '@/lib/repository/evidence';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { logAccess } from '@/lib/repository/users';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/evidence/file/[id] — stream a stored blob through the app rather
 * than redirecting to a SAS URL. Works without `Storage Blob Delegator` on
 * the storage account and lets the in-app preview (`<img src=…>`) render
 * directly. Add `?download=1` to force a save dialog instead of inline view.
 */
export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const id = parseInt(ctx.params.id, 10);
  const force = req.nextUrl.searchParams.get('download') === '1';
  return withEngagement(actor.engagement!.id, async () => {
    const info = await getEvidenceForDownload(actor.engagement!.id, id);
    if (!info) return new NextResponse('Not found', { status: 404 });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
    const ua = req.headers.get('user-agent');
    await logAccess(actor.engagement!.id, actor.userId, 'evidence', id, 'download', ip, ua);
    const safeName = info.filename.replace(/[\r\n"]/g, '_');
    const disposition = `${force ? 'attachment' : 'inline'}; filename="${safeName}"`;
    return new NextResponse(new Uint8Array(info.buffer), {
      headers: {
        'content-type': info.contentType,
        'content-disposition': disposition,
        'content-length': String(info.buffer.length),
        'cache-control': 'private, no-store',
      },
    });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () => {
    await deleteEvidence(actor.engagement!.id, parseInt(ctx.params.id, 10), actor.userId);
    return NextResponse.json({ ok: true });
  });
}
