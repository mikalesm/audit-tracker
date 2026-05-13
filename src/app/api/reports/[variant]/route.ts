import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { ClientStatusReport, FullStatusReport } from '@/lib/pdf/templates';
import { listPBC } from '@/lib/repository/pbc';
import { listAccess } from '@/lib/repository/access';
import { listWalkthroughs } from '@/lib/repository/walkthroughs';
import { getSettings } from '@/lib/repository/settings';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import React from 'react';
import type { TSC } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: { variant: string } }) {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  const eid = actor.engagement!.id;
  const variant = ctx.params.variant;
  const [settings, allItems, walkthroughs] = await Promise.all([
    getSettings(eid),
    listPBC(eid),
    listWalkthroughs(eid),
  ]);

  const tscParam = req.nextUrl.searchParams.get('tsc');
  const tscFilter = tscParam ? (tscParam.split(',').filter(Boolean) as TSC[]) : [];
  const items = tscFilter.length > 0
    ? allItems.filter(i => i.tscMapping.some(t => tscFilter.includes(t)))
    : allItems;

  let element: React.ReactElement;
  if (variant === 'client') {
    element = React.createElement(ClientStatusReport, {
      settings, items, walkthroughs, variant: 'client', tscFilter,
    });
  } else {
    const access = await listAccess(eid);
    element = React.createElement(FullStatusReport, {
      settings, items, access, walkthroughs, variant: 'full', tscFilter,
    });
  }

  const buffer = await renderToBuffer(element);
  const tag = tscFilter.length > 0 ? `-tsc-${tscFilter.join('+')}` : '';
  const filename = `${settings.clientName.replace(/[^A-Za-z0-9]/g, '_')}-${variant}${tag}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
