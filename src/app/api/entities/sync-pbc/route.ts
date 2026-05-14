import { NextResponse } from 'next/server';
import { syncPbcEntityScope } from '@/lib/repository/pbc';
import { requireRole, isErrorResponse } from '@/lib/rbac';
import { withEngagement } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * POST — generate any missing per-entity PBC instances for the engagement's
 * in-scope entities. Idempotent (create-only); safe to re-run.
 */
export async function POST() {
  const actor = await requireRole('auditor');
  if (isErrorResponse(actor)) return actor;
  return withEngagement(actor.engagement!.id, async () =>
    NextResponse.json(await syncPbcEntityScope(actor.engagement!.id, actor.userId))
  );
}
