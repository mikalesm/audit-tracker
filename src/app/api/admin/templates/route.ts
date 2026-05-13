import { NextResponse } from 'next/server';
import { listAllEngagementsWithCounts } from '@/lib/repository/engagements';
import { requirePlatformAdmin, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET — list templates with their item count + the distinct PBC categories
 * present. Used by both the admin templates table and the "Use template"
 * dropdown on the new-engagement form.
 */
export async function GET() {
  const actor = await requirePlatformAdmin();
  if (isErrorResponse(actor)) return actor;
  return NextResponse.json(await listAllEngagementsWithCounts({ kind: 'template' }));
}
