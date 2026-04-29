import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import type { Role } from '@/lib/repository/users';

export type { Role };

const RANK: Record<Role, number> = {
  auditor_lead: 4,
  auditor: 3,
  client_owner: 2,
  client_reviewer: 1,
};

/** Returns true if the actor's role meets-or-exceeds `min`. */
export function hasRole(actor: Role | undefined | null, min: Role): boolean {
  if (!actor) return false;
  return RANK[actor] >= RANK[min];
}

export interface ActorSession {
  userId: number;
  email: string;
  role: Role;
}

/**
 * Resolve the current actor for an API route. Returns null when there is no
 * authenticated session — callers should respond with 401.
 */
export async function getActor(): Promise<ActorSession | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role,
  };
}

/**
 * Wrap a route handler with auth + role enforcement. Returns 401 if no session,
 * 403 if the actor's role is below `minRole`.
 */
export async function requireRole(minRole: Role): Promise<ActorSession | NextResponse> {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  if (!hasRole(actor.role, minRole)) {
    return NextResponse.json({ error: 'forbidden', requiredRole: minRole }, { status: 403 });
  }
  return actor;
}

export function isErrorResponse(x: ActorSession | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}
