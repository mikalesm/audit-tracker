import { NextRequest, NextResponse } from 'next/server';
import { importFromExcelBuffer } from '@/lib/excel/import';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;
  try {
    const fd = await req.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file uploaded. Send a multipart/form-data POST with a "file" field containing the Excel.' }, { status: 400 });
    }
    if (file.size === 0 || file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'File is empty or larger than 100 MB.' }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const summary = await importFromExcelBuffer(buf);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
