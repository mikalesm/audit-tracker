import { NextResponse } from 'next/server';
import { getActor } from '@/lib/rbac';
import { listEngagementsForUser } from '@/lib/repository/engagements';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 });
  const engagements = await listEngagementsForUser(actor.userId);
  return NextResponse.json({
    authenticated: true,
    user: {
      userId: actor.userId,
      email: actor.email,
      systemRole: actor.systemRole,
      currentRole: actor.role,
      currentEngagement: actor.engagement,
    },
    engagements,
  });
}
