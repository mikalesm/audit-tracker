import { NextRequest, NextResponse } from 'next/server';
import { listSavedViews, createSavedView } from '@/lib/repository/savedViews';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const scope = req.nextUrl.searchParams.get('scope') || 'pbc';
  return NextResponse.json(await listSavedViews(actor.engagement!.id, scope, actor.userId));
}

export async function POST(req: NextRequest) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const body = await req.json();
  const scope = String(body.scope || 'pbc');
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
  return NextResponse.json(await createSavedView(actor.engagement!.id, scope, name, filters, actor.userId));
}
