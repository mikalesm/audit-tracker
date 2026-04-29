import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);
  const db = await getDb();
  const like = `%${q}%`;
  const results: { type: string; id: number; title: string; subtitle?: string; href: string }[] = [];

  const pbc = (await db.query<{ id: number; num: number; category: string; title: string; priority: string; status: string }>(
    `SELECT id, num, category, item_requested as title, priority, status FROM pbc_items
     WHERE item_requested ILIKE $1 OR notes ILIKE $1 OR category ILIKE $1
     ORDER BY num LIMIT 12`,
    [like]
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
     WHERE process_area ILIKE $1 OR key_topics ILIKE $1 LIMIT 6`,
    [like]
  )).rows;
  for (const r of walks) {
    results.push({ type: 'walkthrough', id: Number(r.id), title: `#${r.num} · ${r.process_area}`, subtitle: r.key_topics?.slice(0, 100), href: '/walkthroughs' });
  }

  const ents = (await db.query<{ id: number; num: number; legal_entity: string | null; country_location: string | null }>(
    `SELECT id, num, legal_entity, country_location FROM entities
     WHERE legal_entity ILIKE $1 OR country_location ILIKE $1 LIMIT 6`,
    [like]
  )).rows;
  for (const r of ents) {
    if (!r.legal_entity) continue;
    results.push({ type: 'entity', id: Number(r.id), title: r.legal_entity, subtitle: r.country_location || undefined, href: '/entities' });
  }

  const access = (await db.query<{ id: number; num: number; system: string; access_type: string }>(
    `SELECT id, num, system, access_type FROM access_requests
     WHERE system ILIKE $1 OR access_type ILIKE $1 LIMIT 6`,
    [like]
  )).rows;
  for (const r of access) {
    results.push({ type: 'access', id: Number(r.id), title: `#${r.num} · ${r.system}`, subtitle: r.access_type, href: '/access' });
  }

  return NextResponse.json(results);
}
