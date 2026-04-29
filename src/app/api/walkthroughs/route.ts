import { NextResponse } from 'next/server';
import { listWalkthroughs } from '@/lib/repository/walkthroughs';

export const dynamic = 'force-dynamic';
export async function GET() {
  return NextResponse.json(await listWalkthroughs());
}
