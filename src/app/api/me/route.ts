import { NextResponse } from 'next/server';
import { getActor } from '@/lib/rbac';
import { listEngagementsForUser, engagementSectionCounts } from '@/lib/repository/engagements';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ authenticated: false }, { status: 401 });
  const engagements = await listEngagementsForUser(actor.userId);
  // Section counts drive nav visibility (the shell hides empty sections).
  // Only meaningful when an engagement is selected — otherwise the shell
  // renders bare chrome and the field is null.
  const sectionCounts = actor.engagement
    ? await withEngagement(actor.engagement.id, () => engagementSectionCounts(actor.engagement!.id))
    : null;
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
    sectionCounts,
  });
}
