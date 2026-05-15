import { NextRequest, NextResponse } from 'next/server';
import { searchEntraUsers, isGraphConfigured } from '@/lib/graph';
import { requireAuth, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/entra-users?q=…
 *
 * Tenant directory search backing the Members page picker. Restricted to
 * authenticated users (anyone with engagement access already sees member emails).
 * If Graph isn't configured (local dev) or the call fails, returns a structured
 * payload so the UI can transparently fall back to plain email entry.
 */
export async function GET(req: NextRequest) {
  const actor = await requireAuth();
  if (isErrorResponse(actor)) return actor;

  if (!isGraphConfigured()) {
    return NextResponse.json({
      available: false,
      users: [],
      reason: 'Microsoft Graph is not configured for this deployment.',
    });
  }

  const q = req.nextUrl.searchParams.get('q') ?? '';
  try {
    const result = await searchEntraUsers(q);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('[entra-users] search failed:', message);
    return NextResponse.json(
      { available: true, users: [], reason: message },
      { status: 502 },
    );
  }
}
