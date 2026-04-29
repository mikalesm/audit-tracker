import { NextRequest, NextResponse } from 'next/server';
import { deleteSavedView } from '@/lib/repository/savedViews';

export async function DELETE(_req: NextRequest, ctx: { params: { id: string } }) {
  await deleteSavedView(parseInt(ctx.params.id, 10));
  return NextResponse.json({ ok: true });
}
