import { NextRequest, NextResponse } from 'next/server';
import { setUserActive } from '@/lib/repository/users';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

/**
 * Platform-level user admin: only `isActive` is mutable here (it disables
 * sign-in across all engagements). Per-engagement role changes go through
 * /api/engagements/[slug]/members.
 */
export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;

  const id = parseInt(ctx.params.id, 10);
  const body = await req.json();

  if (typeof body.isActive !== 'boolean') {
    return NextResponse.json(
      { error: 'only isActive can be patched at the platform level; use /api/engagements/[slug]/members for per-engagement roles' },
      { status: 400 }
    );
  }
  const updated = await setUserActive(id, body.isActive);
  return NextResponse.json(updated);
}
