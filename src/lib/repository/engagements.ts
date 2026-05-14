import { getDb } from '@/lib/db';
import type { Role } from '@/lib/repository/users';
import {
  LIBRARY,
  type LibrarySelection,
  type PBCCategory,
} from '@/lib/templates/library';

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
  const db = await getDb();
  const kind = opts.kind ?? 'client';
  const where =
    kind === 'template' ? 'WHERE e.is_template = TRUE'
    : kind === 'all'    ? ''
    :                     'WHERE e.is_template = FALSE';
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
}

export async function setEngagementStatus(slug: string, status: EngagementStatus): Promise<Engagement | null> {
  const db = await getDb();
  const r = await db.query<EngagementRow>(
    `UPDATE engagements SET status = $2 WHERE slug = $1 RETURNING *`,
    [slug, status]
  );
  return r.rows[0] ? toEngagement(r.rows[0]) : null;
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
  const db = await getDb();
  return db.withTx(async (tx) => {
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
  tx: { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number }> },
  engagementId: number,
  selection: LibrarySelection,
): Promise<void> {
  // PBC items, filtered by category. Use insertion order so num is stable.
  const picked = selection.pbcCategories as PBCCategory[];
  if (picked.length > 0) {
    const allowed = new Set<PBCCategory>(picked);
    const filtered = LIBRARY.pbc.filter((i) => allowed.has(i.category));
    let n = 0;
    for (const item of filtered) {
      n += 1;
      await tx.query(
        `INSERT INTO pbc_items (
            engagement_id, num, category, item_requested, why_purpose, format_expected,
            priority, tsc_mapping
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
        [
          engagementId, n, item.category, item.itemRequested, item.whyPurpose,
          item.formatExpected, item.priority, JSON.stringify(item.tscMapping),
        ]
      );
    }
  }

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

  if (selection.includeEntities) {
    let n = 0;
    for (const e of LIBRARY.entities) {
      n += 1;
      await tx.query(
        `INSERT INTO entities (
            engagement_id, num, legal_entity, country_location, it_model,
            key_applications, hosting, headcount, in_scope, rationale
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [engagementId, n, e.legalEntity, e.countryLocation, e.itModel,
         e.keyApplications, e.hosting, e.headcount, e.inScope, e.rationale]
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

/**
 * Copy PBC/access/walkthroughs/entities/sampling rows from one engagement
 * into another. Per-client fields are reset to defaults so the destination
 * starts clean. Templated columns (category, item_requested, etc.) are
 * preserved. Activity log + evidence files are never copied.
 */
async function copyTemplateRows(
  tx: { query: (sql: string, params: unknown[]) => Promise<{ rowCount: number }> },
  sourceId: number,
  targetId: number,
): Promise<void> {
  // PBC items — preserve everything except per-client status/dates/owner/notes.
  await tx.query(
    `INSERT INTO pbc_items (
        engagement_id, num, category, item_requested, why_purpose, format_expected,
        priority, tsc_mapping, internal_comments
      )
      SELECT $1, num, category, item_requested, why_purpose, format_expected,
             priority, tsc_mapping, internal_comments
        FROM pbc_items
       WHERE engagement_id = $2
       ORDER BY num`,
    [targetId, sourceId]
  );
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
  // Entities — copy as-is (templates of in-scope/out-of-scope examples).
  await tx.query(
    `INSERT INTO entities (
        engagement_id, num, legal_entity, country_location, it_model,
        key_applications, hosting, headcount, in_scope, rationale
      )
      SELECT $1, num, legal_entity, country_location, it_model,
             key_applications, hosting, headcount, in_scope, rationale
        FROM entities
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
): Promise<Array<Membership & { email: string; displayName: string | null }>> {
  const db = await getDb();
  const r = await db.query<MembershipRow & { email: string; display_name: string | null }>(
    `SELECT m.*, u.email, u.display_name
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
