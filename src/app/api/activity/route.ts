import { NextRequest, NextResponse } from 'next/server';
import { recentActivity, activityFor } from '@/lib/repository/activity';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get('type');
  const id = req.nextUrl.searchParams.get('id');
  if (type && id) {
    return NextResponse.json(await activityFor(type, parseInt(id, 10)));
  }
  return NextResponse.json(await recentActivity(200));
}
