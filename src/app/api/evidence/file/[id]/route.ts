import { NextRequest, NextResponse } from 'next/server';
import { deleteEvidence, getEvidenceForDownload, getEvidenceMeta } from '@/lib/repository/evidence';
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
  try {
    return await withEngagement(actor.engagement!.id, async () => {
      const info = await getEvidenceForDownload(actor.engagement!.id, id);
      if (!info) return new NextResponse('Not found', { status: 404 });
      // Best-effort access log — never let it kill the download.
      try {
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
        const ua = req.headers.get('user-agent');
        await logAccess(actor.engagement!.id, actor.userId, 'evidence', id, 'download', ip, ua);
      } catch (logErr) {
        console.warn('evidence-download:logAccess', String(logErr));
      }
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
  } catch (err) {
    // Surface the real failure in the response body so we can debug from the
    // browser network tab. Prod-safe because the route requires authentication.
    const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    const stack = err instanceof Error && err.stack ? err.stack : '';
    console.error('evidence-download:GET', { id, message, stack });
    return new NextResponse(
      `evidence-download failed (id=${id})\n${message}\n${stack}`,
      { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }
}

/**
 * Allow the original uploader to remove their own evidence (typo, wrong file)
 * and `auditor_lead` to remove anything. Plain `auditor` and `client_reviewer`
 * cannot delete files they didn't upload — keeps audit history intact.
 */
export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('client_owner');
  if (isErrorResponse(actor)) return actor;
  const id = parseInt(ctx.params.id, 10);
  return withEngagement(actor.engagement!.id, async () => {
    const meta = await getEvidenceMeta(actor.engagement!.id, id);
    if (!meta) return new NextResponse('Not found', { status: 404 });
    const isLead = actor.role === 'auditor_lead';
    const isUploader = meta.uploadedById !== null && meta.uploadedById === actor.userId;
    if (!isLead && !isUploader) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    await deleteEvidence(actor.engagement!.id, id, actor.userId);
    return NextResponse.json({ ok: true });
  });
}
