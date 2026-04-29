import { NextResponse } from 'next/server';
import { listAccess } from '@/lib/repository/access';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await listAccess());
}
