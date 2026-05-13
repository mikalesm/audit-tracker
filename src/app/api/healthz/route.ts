import { NextResponse } from 'next/server';
import { getDb, getDbEngine } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = await getDb();
    await db.query('SELECT 1');
    const engine = getDbEngine();
    // In Azure App Service, pglite would mean data is in-memory and would
    // not survive restart. Flag it loudly so smoke checks can fail fast.
    const inAzure = !!process.env.WEBSITE_SITE_NAME;
    const degraded = inAzure && engine === 'pglite';
    return NextResponse.json({
      ok: !degraded,
      db: 'up',
      engine,
      degraded,
      ts: new Date().toISOString(),
    }, { status: degraded ? 503 : 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
