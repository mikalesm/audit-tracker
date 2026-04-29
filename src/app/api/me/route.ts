import { NextResponse } from 'next/server';
import { getActor } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({
    authenticated: true,
    user: actor,
  });
}
