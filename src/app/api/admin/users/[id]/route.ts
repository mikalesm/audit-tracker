import { NextRequest, NextResponse } from 'next/server';
import { setUserActive, setUserSystemRole } from '@/lib/repository/users';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;

  const id = parseInt(ctx.params.id, 10);
  let body: { isActive?: boolean; systemRole?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  let updated = null;
  if (typeof body.isActive === 'boolean') {
    updated = await setUserActive(id, body.isActive);
  }
  if (typeof body.systemRole === 'string') {
    if (body.systemRole !== 'platform_admin' && body.systemRole !== 'member') {
      return NextResponse.json({ error: 'systemRole must be platform_admin or member' }, { status: 400 });
    }
    if (id === actor.userId && body.systemRole === 'member') {
      return NextResponse.json({ error: 'cannot demote yourself' }, { status: 400 });
    }
    updated = await setUserSystemRole(id, body.systemRole);
  }
  if (!updated) return NextResponse.json({ error: 'no changes — pass isActive or systemRole' }, { status: 400 });
  return NextResponse.json(updated);
}
