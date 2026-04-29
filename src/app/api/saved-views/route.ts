import { NextRequest, NextResponse } from 'next/server';
import { listSavedViews, createSavedView } from '@/lib/repository/savedViews';
import { getActor } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await getActor();
  const scope = req.nextUrl.searchParams.get('scope') || 'pbc';
  return NextResponse.json(await listSavedViews(scope, actor?.userId ?? null));
}

export async function POST(req: NextRequest) {
  const actor = await getActor();
  const body = await req.json();
  const scope = String(body.scope || 'pbc');
  const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const filters = body.filters && typeof body.filters === 'object' ? body.filters : {};
  return NextResponse.json(await createSavedView(scope, name, filters, actor?.userId ?? null));
}
