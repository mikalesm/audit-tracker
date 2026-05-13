import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import type { Role } from '@/lib/repository/users';
import { getEngagementBySlug, getMembership, type Engagement } from '@/lib/repository/engagements';

export type { Role };
export const ENGAGEMENT_COOKIE = 'audit_engagement';

const RANK: Record<Role, number> = {
  auditor_lead: 4,
  auditor: 3,
  client_owner: 2,
  client_reviewer: 1,
};

export function hasRole(actor: Role | undefined | null, min: Role): boolean {
  if (!actor) return false;
  return RANK[actor] >= RANK[min];
}

export interface ActorSession {
  userId: number;
  email: string;
  systemRole: 'platform_admin' | 'member';
  /**
   * Per-engagement role for the current engagement. Resolved from the
   * audit_engagement cookie + engagement_memberships lookup. Null when no
   * engagement is selected (e.g. on /engagements or /engagements/new).
   */
  role: Role | null;
  /** Current engagement, when selected via cookie. */
  engagement: Engagement | null;
}

/**
 * Resolve the current actor for an API route. Returns null when there is no
 * authenticated session — callers should respond with 401.
 */
export async function getActor(): Promise<ActorSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = session.user;

  let engagement: Engagement | null = null;
  let role: Role | null = null;
  const slug = cookies().get(ENGAGEMENT_COOKIE)?.value;
  if (slug) {
    const eng = await getEngagementBySlug(slug);
    if (eng) {
      const m = await getMembership(eng.id, user.id);
      if (m) {
        engagement = eng;
        role = m.role;
      }
    }
  }

  return {
    userId: user.id,
    email: user.email,
    systemRole: (user.systemRole as 'platform_admin' | 'member') ?? 'member',
    role,
    engagement,
  };
}

/**
 * Require an authenticated session + a selected engagement + minimum role in
 * that engagement. Returns 401/403/400 NextResponse on failure.
 */
export async function requireRole(minRole: Role): Promise<ActorSession | NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (!actor.engagement || !actor.role) {
    return NextResponse.json({ error: 'no engagement selected' }, { status: 400 });
  }
  if (!hasRole(actor.role, minRole)) {
    return NextResponse.json({ error: 'forbidden', requiredRole: minRole }, { status: 403 });
  }
  return actor;
}

/** Require platform_admin system role (NOT engagement-scoped). */
export async function requirePlatformAdmin(): Promise<ActorSession | NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  if (actor.systemRole !== 'platform_admin') {
    return NextResponse.json({ error: 'forbidden', requiresPlatformAdmin: true }, { status: 403 });
  }
  return actor;
}

/** Just need an authenticated user, no engagement/role check. */
export async function requireAuth(): Promise<ActorSession | NextResponse> {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  return actor;
}

export function isErrorResponse(x: ActorSession | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}
