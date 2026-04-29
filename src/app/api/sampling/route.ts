import { NextResponse } from 'next/server';
import { listSampling } from '@/lib/repository/sampling';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await listSampling());
}
