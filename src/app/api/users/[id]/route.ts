import { NextRequest, NextResponse } from 'next/server';
import { setUserActive, setUserRole, type Role, ROLES } from '@/lib/repository/users';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export async function PATCH(req: NextRequest, ctx: { params: { id: string } }) {
  const actor = await requireRole('auditor_lead');
  if (isErrorResponse(actor)) return actor;

  const id = parseInt(ctx.params.id, 10);
  const body = await req.json();
  let updated = null;

  if (typeof body.role === 'string') {
    if (!ROLES.includes(body.role as Role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    updated = await setUserRole(id, body.role as Role);
  }
  if (typeof body.isActive === 'boolean') {
    updated = await setUserActive(id, body.isActive);
  }
  if (!updated) return NextResponse.json({ error: 'no changes' }, { status: 400 });

  return NextResponse.json(updated);
}
