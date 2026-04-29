import { NextResponse } from 'next/server';
import { listPBC } from '@/lib/repository/pbc';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listPBC());
}
