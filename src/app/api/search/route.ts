import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireRole, isErrorResponse } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const actor = await requireRole('client_reviewer');
  if (isErrorResponse(actor)) return actor;
  const eid = actor.engagement!.id;
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);
  const db = await getDb();
  const like = `%${q}%`;
  const results: { type: string; id: number; title: string; subtitle?: string; href: string }[] = [];

  const pbc = (await db.query<{ id: number; num: number; category: string; title: string; priority: string; status: string }>(
    `SELECT id, num, category, item_requested as title, priority, status FROM pbc_items
     WHERE engagement_id = $1 AND (item_requested ILIKE $2 OR notes ILIKE $2 OR category ILIKE $2)
     ORDER BY num LIMIT 12`,
    [eid, like]
  )).rows;
  for (const r of pbc) {
    results.push({
      type: 'pbc', id: Number(r.id),
      title: `#${r.num} · ${r.title.slice(0, 100)}`,
      subtitle: `${r.category} · ${r.status} · ${r.priority}`,
      href: `/pbc?id=${r.id}`,
    });
  }

  const walks = (await db.query<{ id: number; num: number; process_area: string; key_topics: string }>(
    `SELECT id, num, process_area, key_topics FROM walkthroughs
     WHERE engagement_id = $1 AND (process_area ILIKE $2 OR key_topics ILIKE $2) LIMIT 6`,
    [eid, like]
  )).rows;
  for (const r of walks) {
    results.push({ type: 'walkthrough', id: Number(r.id), title: `#${r.num} · ${r.process_area}`, subtitle: r.key_topics?.slice(0, 100), href: '/walkthroughs' });
  }

  const ents = (await db.query<{ id: number; num: number; legal_entity: string | null; country_location: string | null }>(
    `SELECT id, num, legal_entity, country_location FROM entities
     WHERE engagement_id = $1 AND (legal_entity ILIKE $2 OR country_location ILIKE $2) LIMIT 6`,
    [eid, like]
  )).rows;
  for (const r of ents) {
    if (!r.legal_entity) continue;
    results.push({ type: 'entity', id: Number(r.id), title: r.legal_entity, subtitle: r.country_location || undefined, href: '/entities' });
  }

  const access = (await db.query<{ id: number; num: number; system: string; access_type: string }>(
    `SELECT id, num, system, access_type FROM access_requests
     WHERE engagement_id = $1 AND (system ILIKE $2 OR access_type ILIKE $2) LIMIT 6`,
    [eid, like]
  )).rows;
  for (const r of access) {
    results.push({ type: 'access', id: Number(r.id), title: `#${r.num} · ${r.system}`, subtitle: r.access_type, href: '/access' });
  }

  return NextResponse.json(results);
}
