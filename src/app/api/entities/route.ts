import { NextResponse } from 'next/server';
import { listEntities, addEntity } from '@/lib/repository/entities';
import { getActor } from '@/lib/rbac';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await listEntities());
}
export async function POST() {
  const actor = await getActor();
  return NextResponse.json(await addEntity(actor?.userId ?? null));
}
