import { NextRequest, NextResponse } from 'next/server';
import { upsertUserOnSignIn, setUserSystemRole } from '@/lib/repository/users';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/users — pre-create a user record from a picked Entra
 * directory entry, so the user exists in the platform before they sign in for
 * the first time. Reuses `upsertUserOnSignIn` so that when they actually sign
 * in via NextAuth, the OID already matches and they go straight to the app
 * with whatever system role + memberships were set here.
 *
 * Body: { entraObjectId, email, displayName?, systemRole? }
 */
export async function POST(req: NextRequest) {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;

  let body: {
    entraObjectId?: string;
    email?: string;
    displayName?: string | null;
    systemRole?: string;
  };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const oid = String(body.entraObjectId || '').trim();
  const email = String(body.email || '').trim();
  if (!oid) return NextResponse.json({ error: 'entraObjectId is required' }, { status: 400 });
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });

  const user = await upsertUserOnSignIn(oid, email, body.displayName ?? null);

  if (body.systemRole && body.systemRole !== user.systemRole) {
    if (body.systemRole !== 'platform_admin' && body.systemRole !== 'member') {
      return NextResponse.json({ error: 'systemRole must be platform_admin or member' }, { status: 400 });
    }
    return NextResponse.json(await setUserSystemRole(user.id, body.systemRole));
  }
  return NextResponse.json(user);
}
