import { NextRequest, NextResponse } from 'next/server';
import { exportToWorkbook } from '@/lib/excel/export';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const idsParam = req.nextUrl.searchParams.get('ids');
  const pbcIds = idsParam ? idsParam.split(',').map(s => parseInt(s, 10)).filter(n => !isNaN(n)) : undefined;
  return withEngagement(actor.engagement!.id, async () => {
    const buf = await exportToWorkbook(actor.engagement!.id, pbcIds ? { pbcIds } : undefined);
    const ts = new Date().toISOString().slice(0, 10);
    const tag = pbcIds && pbcIds.length > 0 ? `-selection-${pbcIds.length}` : '';
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Disposition': `attachment; filename="audit-tracker-export${tag}-${ts}.xlsx"`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  });
}
