import { getDb, withBypassRls, type DbAdapter } from '@/lib/db';
import type { Role } from '@/lib/repository/users';
import {
  LIBRARY,
  type LibrarySelection,
  type PBCCategory,
} from '@/lib/templates/library';
import { evidenceContainerFor } from '@/lib/blob';

export type EngagementStatus = 'active' | 'closed' | 'archived';

export interface Engagement {
  id: number;
  slug: string;
  name: string;
  clientName: string;
  fiscalYear: string | null;
  description: string | null;
  status: EngagementStatus;
  isTemplate: boolean;
  createdAt: string;
  createdById: number | null;
}

export interface Membership {
  id: number;
  engagementId: number;
  userId: number;
  role: Role;
  addedAt: string;
}

export interface EngagementForUser extends Engagement {
  role: Role;
}

type EngagementRow = {
  id: number; slug: string; name: string; client_name: string;
  fiscal_year: string | null; description: string | null;
  status: string; is_template: boolean;
  created_at: string | Date; created_by_id: number | null;
};

function toEngagement(r: EngagementRow): Engagement {
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    clientName: r.client_name,
    fiscalYear: r.fiscal_year,
    description: r.description,
    status: r.status as EngagementStatus,
    isTemplate: Boolean(r.is_template),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    createdById: r.created_by_id === null ? null : Number(r.created_by_id),
  };
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export async function listEngagements(): Promise<Engagement[]> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements ORDER BY status, created_at DESC'
  );
  return r.rows.map(toEngagement);
}

/**
 * Listing for platform admin pages: client engagements with their member /
 * item counts AND the distinct PBC categories present. By default templates
 * are excluded; pass `{ kind: 'template' }` for the template list, or
 * `'all'` for everything.
 */
export async function listAllEngagementsWithCounts(
  opts: { kind?: 'client' | 'template' | 'all' } = {},
): Promise<Array<Engagement & { memberCount: number; itemCount: number; categories: string[] }>> {
  const kind = opts.kind ?? 'client';
  const where =
    kind === 'template' ? 'WHERE e.is_template = TRUE'
    : kind === 'all'    ? ''
    :                     'WHERE e.is_template = FALSE';
  // Aggregates over pbc_items across every engagement — inherently
  // cross-engagement, so it runs with RLS bypassed. Only reachable from
  // platform-admin pages / routes.
  return withBypassRls(async (db) => {
    const r = await db.query<EngagementRow & {
      member_count: string | number;
      item_count: string | number;
      categories: string[] | string | null;
    }>(
      `SELECT e.*,
              (SELECT COUNT(*) FROM engagement_memberships m WHERE m.engagement_id = e.id) AS member_count,
              (SELECT COUNT(*) FROM pbc_items p WHERE p.engagement_id = e.id) AS item_count,
              COALESCE(
                (SELECT array_agg(DISTINCT category ORDER BY category)
                   FROM pbc_items WHERE engagement_id = e.id),
                ARRAY[]::text[]
              ) AS categories
         FROM engagements e
         ${where}
        ORDER BY e.status, e.created_at DESC`
    );
    return r.rows.map((row) => ({
      ...toEngagement(row),
      memberCount: Number(row.member_count),
      itemCount: Number(row.item_count),
      categories: Array.isArray(row.categories)
        ? row.categories
        : typeof row.categories === 'string'
          ? (() => { try { return JSON.parse(row.categories as string); } catch { return []; } })()
          : [],
    }));
  });
}

/** Row counts per "section" — drives nav visibility (hide empty sections). */
export interface EngagementSectionCounts {
  pbc: number;
  walkthroughs: number;
  access: number;
  entities: number;
  sampling: number;
}

/**
 * Lightweight per-engagement section counts in one round-trip. Must run inside
 * `withEngagement(engagementId, ...)` because every counted table has RLS.
 */
export async function engagementSectionCounts(engagementId: number): Promise<EngagementSectionCounts> {
  const db = await getDb();
  const r = await db.query<{
    pbc: string | number;
    walkthroughs: string | number;
    access: string | number;
    entities: string | number;
    sampling: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM pbc_items       WHERE engagement_id = $1) AS pbc,
       (SELECT COUNT(*) FROM walkthroughs    WHERE engagement_id = $1) AS walkthroughs,
       (SELECT COUNT(*) FROM access_requests WHERE engagement_id = $1) AS access,
       (SELECT COUNT(*) FROM entities        WHERE engagement_id = $1) AS entities,
       (SELECT COUNT(*) FROM sampling_items  WHERE engagement_id = $1) AS sampling`,
    [engagementId],
  );
  const row = r.rows[0];
  return {
    pbc: Number(row.pbc),
    walkthroughs: Number(row.walkthroughs),
    access: Number(row.access),
    entities: Number(row.entities),
    sampling: Number(row.sampling),
  };
}

export async function setEngagementStatus(slug: string, status: EngagementStatus): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    `UPDATE engagements SET status = $2 WHERE slug = $1 RETURNING *`,
    [slug, status]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
}

/**
 * Permanently delete an engagement (or template) and every row scoped to it.
 *
 * The 0004 migration added `engagement_id` to every domain table without
 * `ON DELETE CASCADE` (only `engagement_memberships` has it), so the rows are
 * wiped explicitly. Runs under `withBypassRls` since it spans tables RLS
 * filters per-engagement, and inside a single transaction so a partial
 * deletion never leaves orphans.
 *
 * Note: Azure Blob Storage containers (per-engagement evidence) are NOT
 * deleted here — that's a best-effort cleanup the caller can do separately.
 */
export async function deleteEngagement(
  slug: string,
): Promise<{ id: number; slug: string; name: string } | null> {
  return withBypassRls(async (tx) => {
    const r = await tx.query<{ id: number; slug: string; name: string }>(
      'SELECT id, slug, name FROM engagements WHERE slug = $1',
      [slug],
    );
    if (r.rows.length === 0) return null;
    const eng = r.rows[0];
    const id = Number(eng.id);
    // Order matters only for evidence_files↔pbc_items (CASCADE on item_id) and
    // pbc_items↔entities (SET NULL on entity_id). Both are tolerant of either
    // order, but we delete inbound-FK targets last for clarity.
    const tables = [
      'activity_log',
      'access_log',
      'saved_views',
      'settings',
      'evidence_files',
      'access_requests',
      'walkthroughs',
      'sampling_items',
      'pbc_items',
      'entities',
      'engagement_memberships',
    ];
    for (const t of tables) {
      await tx.query(`DELETE FROM ${t} WHERE engagement_id = $1`, [id]);
    }
    await tx.query('DELETE FROM engagements WHERE id = $1', [id]);
    return { id, slug: eng.slug, name: eng.name };
  });
}

/**
 * Reset an engagement back to its seeded "project start" state. Wipes
 * activity / access logs, evidence (DB rows + blob files), and PBC notes;
 * clears state-bearing columns on pbc_items, access_requests, walkthroughs,
 * and sampling_items but preserves the seeded structure (titles, categories,
 * priorities, library template links, entity scoping, attendees/duration on
 * walkthroughs, sampling planning numbers).
 *
 * Platform-admin only. Run inside `withBypassRls` so RLS doesn't hide rows
 * from the cleanup. Blob deletion is best-effort and runs first — a failure
 * there shouldn't take down the DB reset, and the per-engagement container
 * is the only thing being touched.
 */
export async function resetEngagementState(slug: string): Promise<{
  id: number; slug: string; name: string; counts: Record<string, number>;
} | null> {
  const db = await getDb();
  const lookup = await db.query<{ id: number; slug: string; name: string }>(
    'SELECT id, slug, name FROM engagements WHERE slug = $1',
    [slug],
  );
  if (lookup.rows.length === 0) return null;
  const meta = lookup.rows[0];
  const id = Number(meta.id);

  // 1) Best-effort blob wipe: list every blob in the per-engagement container
  //    and delete it. Tolerant of missing container / network blips so the
  //    DB reset still proceeds.
  let blobsDeleted = 0;
  try {
    const container = await evidenceContainerFor(id);
    for await (const blob of container.listBlobsFlat()) {
      try {
        await container.deleteBlob(blob.name);
        blobsDeleted += 1;
      } catch { /* swallow per-blob errors */ }
    }
  } catch { /* container missing in dev / Azurite down — skip */ }

  // 2) DB reset in one bypass-RLS transaction.
  const counts = await withBypassRls(async (tx) => {
    const c: Record<string, number> = {};
    for (const t of ['activity_log', 'access_log', 'evidence_files', 'pbc_notes']) {
      const r = await tx.query(`DELETE FROM ${t} WHERE engagement_id = $1`, [id]);
      c[t] = r.rowCount ?? 0;
    }
    const pbcReset = await tx.query(
      `UPDATE pbc_items SET
         status = 'Not Started',
         date_requested = NULL,
         date_received = NULL,
         owner_client = NULL,
         notes = NULL,
         internal_comments = NULL,
         updated_at = NOW()
       WHERE engagement_id = $1`,
      [id],
    );
    c.pbc_items_reset = pbcReset.rowCount ?? 0;
    const accessReset = await tx.query(
      `UPDATE access_requests SET
         status = 'Not Requested',
         provisioned_date = NULL,
         owner_client = NULL,
         notes = NULL,
         updated_at = NOW()
       WHERE engagement_id = $1`,
      [id],
    );
    c.access_requests_reset = accessReset.rowCount ?? 0;
    const wtReset = await tx.query(
      `UPDATE walkthroughs SET
         status = 'Not Scheduled',
         proposed_date = NULL,
         notes = NULL,
         updated_at = NOW()
       WHERE engagement_id = $1`,
      [id],
    );
    c.walkthroughs_reset = wtReset.rowCount ?? 0;
    const sampReset = await tx.query(
      `UPDATE sampling_items SET
         test_status = 'Not Started',
         findings_summary = NULL,
         updated_at = NOW()
       WHERE engagement_id = $1`,
      [id],
    );
    c.sampling_items_reset = sampReset.rowCount ?? 0;
    return c;
  });
  counts.blobs_deleted = blobsDeleted;
  return { id, slug: meta.slug, name: meta.name, counts };
}

export async function getEngagementBySlug(slug: string): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements WHERE slug = $1',
    [slug]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
}

export async function getEngagementById(id: number): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    'SELECT * FROM engagements WHERE id = $1',
    [id]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
}

export interface CreateEngagementInput {
  slug: string;
  name: string;
  clientName: string;
  fiscalYear?: string | null;
  description?: string | null;
  isTemplate?: boolean;
  /** If set, copy PBC/access/walkthroughs/entities/sampling rows from this engagement. */
  fromTemplateId?: number | null;
  /**
   * If set, seed the new engagement from the in-code library, filtered by
   * the selection. Mutually exclusive with `fromTemplateId`.
   */
  librarySeed?: LibrarySelection | null;
  createdById: number;
}

/**
 * Create a new engagement and add the creator as its auditor_lead.
 * Also seeds the default settings rows so the engagement renders.
 *
 * If `fromTemplateId` is set, copy PBC items, access requests, walkthroughs,
 * entities, and sampling controls from that template engagement. Per-client
 * fields (status, dates, owner_client, notes, findings) are reset so the new
 * engagement starts clean.
 */
export async function createEngagement(input: CreateEngagementInput): Promise<Engagement> {
  if (!isValidSlug(input.slug)) {
    throw new Error('invalid slug: lowercase letters, digits, hyphens; 3-32 chars; cannot start or end with -');
  }
  // Spans two engagements (reads a template, writes the new engagement), so it
  // runs with RLS bypassed. Restricted to platform_admin at the route layer.
  return withBypassRls(async (tx) => {
    const r = await tx.query<EngagementRow>(
      `INSERT INTO engagements (slug, name, client_name, fiscal_year, description, is_template, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.slug, input.name, input.clientName,
        input.fiscalYear ?? null, input.description ?? null,
        input.isTemplate === true,
        input.createdById,
      ]
    );
    const eng = toEngagement(r.rows[0]);
    await tx.query(
      `INSERT INTO engagement_memberships (engagement_id, user_id, role)
       VALUES ($1, $2, 'auditor_lead')`,
      [eng.id, input.createdById]
    );
    // Seed default settings rows so /settings renders out of the box.
    await tx.query(
      `INSERT INTO settings (engagement_id, key, value) VALUES
        ($1, 'clientName',   $2),
        ($1, 'auditPeriod',  $3),
        ($1, 'leadAuditor',  ''),
        ($1, 'sponsor',      ''),
        ($1, 'projectTitle', $4)
       ON CONFLICT DO NOTHING`,
      [eng.id, eng.clientName, eng.fiscalYear ?? '', eng.name]
    );
    if (input.fromTemplateId && input.librarySeed) {
      throw new Error('createEngagement: fromTemplateId and librarySeed are mutually exclusive');
    }
    if (input.fromTemplateId) {
      await copyTemplateRows(tx, input.fromTemplateId, eng.id);
    } else if (input.librarySeed) {
      await seedFromLibrary(tx, eng.id, input.librarySeed);
    }
    return eng;
  });
}

/**
 * Insert rows from the in-code LIBRARY into a freshly-created engagement,
 * filtered by `selection`. Per-client fields (status, dates, owner_client,
 * notes, findings_summary) are left to schema defaults so the new engagement
 * starts clean.
 */
async function seedFromLibrary(
  tx: DbAdapter,
  engagementId: number,
  selection: LibrarySelection,
): Promise<void> {
  // Entities first — per-entity PBC items below need their ids.
  const entityRows: SeededEntity[] = [];
  if (selection.includeEntities) {
    let n = 0;
    for (const e of LIBRARY.entities) {
      n += 1;
      const r = await tx.query<{ id: number }>(
        `INSERT INTO entities (
            engagement_id, num, legal_entity, country_location, it_model,
            key_applications, hosting, headcount, in_scope, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id`,
        [engagementId, n, e.legalEntity, e.countryLocation, e.itModel,
         e.keyApplications, e.hosting, e.headcount, e.inScope, e.rationale]
      );
      entityRows.push({ id: Number(r.rows[0].id), inScope: e.inScope });
    }
  }

  // PBC items — group items once, per-entity items once per in-scope entity.
  await seedPbcItems(tx, engagementId, entityRows, selection);

  if (selection.includeAccess) {
    let n = 0;
    for (const a of LIBRARY.access) {
      n += 1;
      await tx.query(
        `INSERT INTO access_requests (
            engagement_id, num, system, access_type, role_permissions,
            recommended_method, justification
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [engagementId, n, a.system, a.accessType, a.rolePermissions, a.recommendedMethod, a.justification]
      );
    }
  }

  if (selection.includeWalkthroughs) {
    let n = 0;
    for (const w of LIBRARY.walkthroughs) {
      n += 1;
      await tx.query(
        `INSERT INTO walkthroughs (
            engagement_id, num, process_area, description, objective,
            key_topics, attendees, duration_min
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [engagementId, n, w.processArea, w.description, w.objective,
         w.keyTopics, w.attendees, w.durationMin]
      );
    }
  }

  if (selection.includeSampling) {
    let n = 0;
    for (const s of LIBRARY.sampling) {
      n += 1;
      await tx.query(
        `INSERT INTO sampling_items (
            engagement_id, num, control_area, control_description,
            population_source, sampling_method
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [engagementId, n, s.controlArea, s.controlDescription, s.populationSource, s.samplingMethod]
      );
    }
  }
}

/** A library entity after insertion, with the id needed to scope PBC items. */
export interface SeededEntity {
  id: number;
  inScope: 'Y' | 'N' | null;
}

/**
 * Insert the LIBRARY PBC items for the selected categories. `scope: 'group'`
 * items get one row (`entity_id` null); `scope: 'entity'` items get one row
 * per in-scope entity (`entity_id` set). With no in-scope entities, per-entity
 * items fall back to a single group-wide row. `num` is one running counter so
 * the per-engagement uniqueness index holds.
 *
 * Exported so the demo re-seed script can reuse it against existing entities.
 */
export async function seedPbcItems(
  tx: DbAdapter,
  engagementId: number,
  entityRows: SeededEntity[],
  selection: Pick<LibrarySelection, 'pbcCategories'>,
): Promise<void> {
  const picked = selection.pbcCategories as PBCCategory[];
  if (picked.length === 0) return;
  const allowed = new Set<PBCCategory>(picked);
  const filtered = LIBRARY.pbc.filter((i) => allowed.has(i.category));
  const inScopeIds = entityRows.filter(e => e.inScope === 'Y').map(e => e.id);

  let n = 0;
  for (const item of filtered) {
    const targets: (number | null)[] =
      item.scope === 'entity' && inScopeIds.length > 0 ? inScopeIds : [null];
    for (const entityId of targets) {
      n += 1;
      await tx.query(
        `INSERT INTO pbc_items (
            engagement_id, num, category, item_requested, why_purpose, format_expected,
            priority, tsc_mapping, entity_id, template_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
        [
          engagementId, n, item.category, item.itemRequested, item.whyPurpose,
          item.formatExpected, item.priority, JSON.stringify(item.tscMapping),
          entityId, item.templateKey,
        ]
      );
    }
  }
}

/**
 * Copy PBC/access/walkthroughs/entities/sampling rows from one engagement
 * into another. Per-client fields are reset to defaults so the destination
 * starts clean. Templated columns (category, item_requested, etc.) are
 * preserved. Activity log + evidence files are never copied.
 */
async function copyTemplateRows(
  tx: DbAdapter,
  sourceId: number,
  targetId: number,
): Promise<void> {
  // Entities first — copy row-by-row so we can map source entity ids to the
  // new ids and translate per-entity PBC rows below.
  const srcEntities = await tx.query<{
    id: number; num: number; legal_entity: string | null; country_location: string | null;
    it_model: string | null; key_applications: string | null; hosting: string | null;
    headcount: number | null; in_scope: string | null; rationale: string | null;
  }>(
    `SELECT * FROM entities WHERE engagement_id = $1 ORDER BY num`,
    [sourceId]
  );
  const entityIdMap = new Map<number, number>();
  for (const e of srcEntities.rows) {
    const r = await tx.query<{ id: number }>(
      `INSERT INTO entities (
          engagement_id, num, legal_entity, country_location, it_model,
          key_applications, hosting, headcount, in_scope, rationale
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id`,
      [targetId, e.num, e.legal_entity, e.country_location, e.it_model,
       e.key_applications, e.hosting, e.headcount, e.in_scope, e.rationale]
    );
    entityIdMap.set(Number(e.id), Number(r.rows[0].id));
  }

  // PBC items — preserve templated columns + scope; translate entity_id.
  const srcPbc = await tx.query<{
    num: number; category: string; item_requested: string; why_purpose: string;
    format_expected: string; priority: string; tsc_mapping: unknown;
    internal_comments: string | null; entity_id: number | null; template_key: string | null;
  }>(
    `SELECT num, category, item_requested, why_purpose, format_expected, priority,
            tsc_mapping, internal_comments, entity_id, template_key
       FROM pbc_items WHERE engagement_id = $1 ORDER BY num`,
    [sourceId]
  );
  for (const p of srcPbc.rows) {
    const mappedEntity = p.entity_id === null ? null : entityIdMap.get(Number(p.entity_id)) ?? null;
    await tx.query(
      `INSERT INTO pbc_items (
          engagement_id, num, category, item_requested, why_purpose, format_expected,
          priority, tsc_mapping, internal_comments, entity_id, template_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11)`,
      [targetId, p.num, p.category, p.item_requested, p.why_purpose, p.format_expected,
       p.priority, JSON.stringify(p.tsc_mapping ?? []), p.internal_comments,
       mappedEntity, p.template_key]
    );
  }

  // Access requests — reset status / provisioned_date / notes.
  await tx.query(
    `INSERT INTO access_requests (
        engagement_id, num, system, access_type, role_permissions,
        recommended_method, justification
      )
      SELECT $1, num, system, access_type, role_permissions,
             recommended_method, justification
        FROM access_requests
       WHERE engagement_id = $2
       ORDER BY num`,
    [targetId, sourceId]
  );
  // Walkthroughs — reset status / proposed_date / notes.
  await tx.query(
    `INSERT INTO walkthroughs (
        engagement_id, num, process_area, description, objective,
        key_topics, attendees, duration_min
      )
      SELECT $1, num, process_area, description, objective,
             key_topics, attendees, duration_min
        FROM walkthroughs
       WHERE engagement_id = $2
       ORDER BY num`,
    [targetId, sourceId]
  );
  // Sampling — reset test_status / findings.
  await tx.query(
    `INSERT INTO sampling_items (
        engagement_id, num, control_area, control_description,
        population_source, sampling_method
      )
      SELECT $1, num, control_area, control_description,
             population_source, sampling_method
        FROM sampling_items
       WHERE engagement_id = $2
       ORDER BY num`,
    [targetId, sourceId]
  );
}

/** Templates that any platform_admin can see when creating a new engagement. */
export async function listTemplates(): Promise<Engagement[]> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    `SELECT * FROM engagements WHERE is_template = TRUE ORDER BY name`
  );
  return r.rows.map(toEngagement);
}

// ---- memberships ----

type MembershipRow = {
  id: number; engagement_id: number; user_id: number; role: string;
  added_at: string | Date;
};

function toMembership(r: MembershipRow): Membership {
  return {
    id: Number(r.id),
    engagementId: Number(r.engagement_id),
    userId: Number(r.user_id),
    role: r.role as Role,
    addedAt: r.added_at instanceof Date ? r.added_at.toISOString() : String(r.added_at),
  };
}

export async function listEngagementsForUser(userId: number): Promise<EngagementForUser[]> {
  const db = await getDb();
  // Templates are hidden from the regular picker — they're managed from /admin
  // and never represent a client engagement.
  const r = await db.query<EngagementRow & { role: string }>(
    `SELECT e.*, m.role
       FROM engagements e
       JOIN engagement_memberships m ON m.engagement_id = e.id
      WHERE m.user_id = $1 AND e.is_template = FALSE
      ORDER BY e.status, e.created_at DESC`,
    [userId]
  );
  return r.rows.map((row) => ({ ...toEngagement(row), role: row.role as Role }));
}

export async function getMembership(
  engagementId: number,
  userId: number,
): Promise<Membership | null> {
  const db = await getDb();
  const r = await db.query<MembershipRow>(
    'SELECT * FROM engagement_memberships WHERE engagement_id = $1 AND user_id = $2',
    [engagementId, userId]
  );
  return r.rows[0] ? toMembership(r.rows[0]) : null;
}

export async function listEngagementMembers(
  engagementId: number,
): Promise<Array<Membership & {
  email: string;
  displayName: string | null;
  /** `'pending::<email>'` when the invited user hasn't signed in yet. */
  entraObjectId: string;
  lastSeenAt: string | null;
}>> {
  const db = await getDb();
  const r = await db.query<MembershipRow & {
    email: string;
    display_name: string | null;
    entra_object_id: string;
    last_seen_at: string | Date | null;
  }>(
    `SELECT m.*, u.email, u.display_name, u.entra_object_id, u.last_seen_at
       FROM engagement_memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.engagement_id = $1
      ORDER BY u.email`,
    [engagementId]
  );
  return r.rows.map((row) => ({
    ...toMembership(row),
    email: row.email,
    displayName: row.display_name,
    entraObjectId: row.entra_object_id,
    lastSeenAt: row.last_seen_at instanceof Date
      ? row.last_seen_at.toISOString()
      : row.last_seen_at,
  }));
}

export async function upsertMembership(
  engagementId: number,
  userId: number,
  role: Role,
): Promise<Membership> {
  const db = await getDb();
  const r = await db.query<MembershipRow>(
    `INSERT INTO engagement_memberships (engagement_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (engagement_id, user_id) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [engagementId, userId, role]
  );
  return toMembership(r.rows[0]);
}

export async function removeMembership(
  engagementId: number,
  userId: number,
): Promise<void> {
  const db = await getDb();
  await db.query(
    'DELETE FROM engagement_memberships WHERE engagement_id = $1 AND user_id = $2',
    [engagementId, userId]
  );
}
