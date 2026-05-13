import { cookies } from 'next/headers';
import { getActor } from '@/lib/rbac';
import {
  getEngagementBySlug,
  getMembership,
  type Engagement,
} from '@/lib/repository/engagements';
import type { Role } from '@/lib/repository/users';

/**
 * Server-side resolver for the actor's "current engagement". We carry the
 * choice in an HTTP-only cookie (engagement_slug) set by /api/engagements/switch
 * after verifying membership. Every request re-validates against the DB so a
 * stale cookie cannot grant access after a membership was revoked.
 */
export interface EngagementContext {
  engagement: Engagement;
  role: Role;
}

export const ENGAGEMENT_COOKIE = 'audit_engagement';

export async function currentEngagement(): Promise<EngagementContext | null> {
  const actor = await getActor();
  if (!actor) return null;
  const slug = cookies().get(ENGAGEMENT_COOKIE)?.value;
  if (!slug) return null;
  const eng = await getEngagementBySlug(slug);
  if (!eng) return null;
  // Re-check membership on every request — never trust the cookie alone.
  const m = await getMembership(eng.id, actor.userId);
  if (!m) return null;
  return { engagement: eng, role: m.role };
}

/**
 * Throws (via NextResponse-flavored error) when the actor has no current
 * engagement or insufficient role within it. Use from API routes.
 */
export async function requireEngagementRole(
  minRole: Role,
): Promise<EngagementContext | { error: true; status: number }> {
  const ctx = await currentEngagement();
  if (!ctx) return { error: true, status: 401 };
  const ranks: Record<Role, number> = {
    auditor_lead: 4, auditor: 3, client_owner: 2, client_reviewer: 1,
  };
  if (ranks[ctx.role] < ranks[minRole]) return { error: true, status: 403 };
  return ctx;
}
