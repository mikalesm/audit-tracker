# Phase C — Multi-tenant cutover plan

Phase A (migration `0004_multitenant.sql`) and Phase B (`src/lib/repository/engagements.ts`,
`src/lib/engagement.ts`) are merged. The live single-engagement `audit1`
deployment continues to work because every existing row was backfilled into
that engagement and the unscoped queries still see all rows.

Phase C is the **cutover**: every repository becomes engagement-scoped, every
API route resolves the current engagement, new pages let `platform_admin` create
engagements and let any user pick which one to enter. It must land in **one
atomic PR** because the changes are intertwined — half-applied state would let
queries leak across engagements.

This document is the exact, file-by-file recipe. Follow it top-to-bottom.

## Pre-flight

1. Branch off `claude/review-project-status-d2Jv4` (commit `cd816ed` or later).
2. Confirm Phase A migration is applied in production:
   ```bash
   PGPASSWORD=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv) \
     psql "host=psql-audit-audit1-prod.postgres.database.azure.com port=5432 dbname=audit user=$(az ad signed-in-user show --query userPrincipalName -o tsv) sslmode=require" \
     -c "\dt engagements"
   ```
   should show the table.
3. Confirm the `audit1` engagement row exists:
   ```sql
   SELECT id, slug, name FROM engagements;
   ```
   should return one row with `slug = 'audit1'`.

## Step 1 — Repository refactor

Every domain repo function gains `engagementId: number` as its **first**
parameter. Every query gains `WHERE engagement_id = $N`. Every `INSERT` gains
an `engagement_id` column.

Files to edit (all under `src/lib/repository/`):

- `pbc.ts` — `listPBC`, `getPBC`, `updatePBC`, `pbcStatusCounts`,
  `pbcCategoryStatus`, `pbcPriorityCounts`, `pbcOutstandingHigh`,
  `pbcReceivedTrend`, `pbcOverdue`
- `activity.ts` — `logActivity` (signature changes: gains
  `engagementId` as first arg), `recentActivity`, `activityFor`,
  `recentPBCActivityWithTitles`, `engagementTimeline`
- `access.ts` — `listAccess`, `updateAccess`
- `walkthroughs.ts` — `listWalkthroughs`, `updateWalkthrough`,
  `upcomingWalkthroughs`
- `entities.ts` — `listEntities`, `updateEntity`, `addEntity`,
  `deleteEntity`, `entitiesInScope`
- `sampling.ts` — `listSampling`, `updateSampling`
- `evidence.ts` — `listForItem`, `add`, `delete`, `find`
- `settings.ts` — `getSettings`, `setSetting`
- `savedViews.ts` — `listViews`, `createView`, `deleteView`

Pattern for each:

```ts
// before
export async function listPBC(): Promise<PBCItem[]> {
  const db = await getDb();
  const r = await db.query<Row>('SELECT * FROM pbc_items ORDER BY num');
  return r.rows.map(rowToItem);
}

// after
export async function listPBC(engagementId: number): Promise<PBCItem[]> {
  const db = await getDb();
  const r = await db.query<Row>(
    'SELECT * FROM pbc_items WHERE engagement_id = $1 ORDER BY num',
    [engagementId]
  );
  return r.rows.map(rowToItem);
}
```

For functions that INSERT, the new row must carry `engagement_id`:

```ts
// in addEntity(engagementId, userId)
await db.query(
  'INSERT INTO entities (engagement_id, num) VALUES ($1, $2) RETURNING *',
  [engagementId, next]
);
```

For `logActivity`, **every caller** also needs updating (about 9 call sites
across the repos and 1 in the Excel importer). The signature becomes:

```ts
export async function logActivity(
  engagementId: number,
  entityType: string,
  entityId: number,
  field: string,
  oldValue: string | null,
  newValue: string | null,
  userId: number | null = null,
  tx?: DbAdapter,
): Promise<void>
```

## Step 2 — API route refactor

Every API route under `src/app/api/` (except `/api/auth`, `/api/healthz`,
`/api/me`, `/api/engagements*`) must resolve the current engagement and pass
its id through:

```ts
// before
export async function GET() {
  const items = await listPBC();
  return NextResponse.json(items);
}

// after
import { currentEngagement } from '@/lib/engagement';

export async function GET() {
  const ctx = await currentEngagement();
  if (!ctx) return NextResponse.json({ error: 'no engagement selected' }, { status: 400 });
  const items = await listPBC(ctx.engagement.id);
  return NextResponse.json(items);
}
```

Routes to edit:

| File | Calls to update |
| --- | --- |
| `src/app/api/pbc/route.ts` | `listPBC(ctx.engagement.id)` |
| `src/app/api/pbc/[id]/route.ts` | `getPBC`, `updatePBC` |
| `src/app/api/access/route.ts` | `listAccess`, `updateAccess` |
| `src/app/api/walkthroughs/*` | `listWalkthroughs`, `updateWalkthrough` |
| `src/app/api/entities/*` | all entity functions |
| `src/app/api/sampling/*` | `listSampling`, `updateSampling` |
| `src/app/api/activity/route.ts` | `recentActivity` |
| `src/app/api/timeline/route.ts` | `engagementTimeline` |
| `src/app/api/dashboard/route.ts` | 8 repo calls — all need ctx.engagement.id |
| `src/app/api/search/route.ts` | search across pbc — scoped to engagement |
| `src/app/api/evidence/*` | scoped to engagement |
| `src/app/api/export/route.ts` | engagement-scoped Excel export |
| `src/app/api/import/route.ts` | engagement-scoped Excel import |
| `src/app/api/reports/[variant]/route.ts` | engagement-scoped PDF |
| `src/app/api/settings/route.ts` | `getSettings(ctx.engagement.id)` |
| `src/app/api/saved-views/*` | engagement-scoped |

Update RBAC at the same time: `requireRole` becomes
`requireEngagementRole(minRole)` (already implemented in
`src/lib/engagement.ts`) and looks up the per-engagement role from
`engagement_memberships` instead of the global `users.role`.

Top-level routes that **don't** scope to an engagement:

- `/api/me` — returns user + system_role + list of memberships
- `/api/engagements` (GET) — list memberships for the actor
- `/api/engagements` (POST) — `platform_admin` only, create new engagement
- `/api/engagements/[slug]/switch` (POST) — verify membership, set cookie
- `/api/engagements/[slug]/members` (GET/POST/PATCH/DELETE) — engagement lead manages members
- `/api/healthz` — unchanged
- `/api/auth/*` — unchanged

## Step 3 — Excel import becomes engagement-scoped

`src/lib/excel/import.ts` currently uses raw INSERTs against domain tables.
Every INSERT must include `engagement_id`. The import API route
(`/api/import`) takes the engagement from `currentEngagement()` and passes the
id into `importFromExcelBuffer(engagementId, buf)`.

## Step 4 — Blob storage isolation

Currently one container (`evidence`) shared across the deployment. Change to:

- One container per engagement, named `evidence-<engagement_id>`.
- Created on engagement creation (in `createEngagement` in
  `src/lib/repository/engagements.ts`):
  ```ts
  import { ensureContainer } from '@/lib/blob';
  // inside the withTx, after creating the engagement row
  await ensureContainer(`evidence-${eng.id}`);
  ```
- `src/lib/blob.ts` exposes `containerFor(engagementId)` and uses it for SAS URL
  generation; the existing `EVIDENCE_CONTAINER` env var becomes a default
  prefix only.
- Evidence routes pass `containerFor(ctx.engagement.id)`.

## Step 5 — New engagement-picker page + admin UI

New files:

- `src/app/engagements/page.tsx` — server component listing
  `listEngagementsForUser(actor.userId)`. Each card shows engagement name +
  user's role + a "Enter" button that POSTs to
  `/api/engagements/[slug]/switch` and redirects to `/`. Includes a
  "+ New audit" button for `system_role === 'platform_admin'` that opens the
  create form below.
- `src/app/engagements/new/page.tsx` — form: slug, name, client name, fiscal
  year, description. POSTs to `/api/engagements`. Restricted to
  `platform_admin` (returns 403 otherwise).
- `src/app/engagements/[slug]/members/page.tsx` — auditor_lead manages who can
  see this engagement (add by email, change role, remove).

## Step 6 — Sign-in flow change

In `src/lib/auth.ts` `session` callback, also fetch
`listEngagementsForUser(token.dbId)`. Add to session: `engagements: Array<{slug,role}>`
plus `systemRole`.

In `src/app/page.tsx` (or a new top-level `src/app/(dashboard)/layout.tsx`):

```ts
const ctx = await currentEngagement();
if (!ctx) {
  const session = await auth();
  if (!session) redirect('/signin');
  const list = await listEngagementsForUser(session.user.id);
  if (list.length === 0) redirect('/engagements/empty'); // no memberships yet
  if (list.length === 1) {
    // Auto-set cookie to the only engagement; redirect to /
    cookies().set('audit_engagement', list[0].slug, { httpOnly: true });
    redirect('/');
  }
  redirect('/engagements'); // > 1, let user pick
}
```

## Step 7 — Engagement switcher in header

In `src/components/shell/Shell.tsx`, replace the static engagement name with a
dropdown listing `session.engagements`. Selecting one POSTs to
`/api/engagements/[slug]/switch` and reloads.

## Step 8 — RLS hardening (migration `0005_rls.sql`)

After every query is engagement-scoped, lock down Postgres so a future bug
cannot leak:

```sql
-- 0005_rls.sql
ALTER TABLE pbc_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkthroughs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sampling_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log    ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_files  ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views     ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_log      ENABLE ROW LEVEL SECURITY;

-- Policy: rows are visible iff engagement_id matches the session var, OR the
-- session is in platform-admin bypass mode. Each table gets the same policy.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['pbc_items','access_requests','walkthroughs','entities',
                           'sampling_items','activity_log','evidence_files','settings',
                           'saved_views','access_log']
  LOOP
    EXECUTE format('CREATE POLICY %I_engagement_isolation ON %I FOR ALL USING (
      current_setting(''app.bypass_rls'', true) = ''true''
      OR engagement_id = NULLIF(current_setting(''app.engagement_id'', true), '''')::bigint
    )', t, t);
  END LOOP;
END$$;
```

And in `src/lib/db.ts`, every request-scoped query must run inside a
transaction that first executes:

```sql
SET LOCAL app.engagement_id = <id>;
```

The cleanest way: add `withEngagement(engagementId, fn)` to `DbAdapter` and
update each API route to wrap its DB work in it:

```ts
import { withEngagement } from '@/lib/db';

export async function GET() {
  const ctx = await currentEngagement();
  if (!ctx) return NextResponse.json({ error: 'no engagement' }, { status: 400 });
  return withEngagement(ctx.engagement.id, async () => {
    const items = await listPBC(ctx.engagement.id);
    return NextResponse.json(items);
  });
}
```

`withEngagement` opens a tx, sets the session var, runs the callback, commits.

For platform_admin operations (listing all engagements), use
`withBypassRls(fn)` which sets `app.bypass_rls = true` instead.

## Step 9 — Update Playwright suite

New scenarios in `e2e/multitenant.spec.ts`:

1. Platform admin creates two engagements (`alpha`, `beta`).
2. Lead signs into `alpha`, uploads an Excel fixture → 55 PBC items visible.
3. Lead switches to `beta` → 0 PBC items visible (no leak).
4. Lead invites a client_owner to `alpha` only.
5. Client signs in → only sees `alpha`, can edit; `/api/engagements/beta/switch` returns 403.
6. Auditor sign-out, sign back in as platform admin → can see both.
7. Restart container, re-check counts. (Persistence sanity.)

## Step 10 — PROD-SMOKE.md update

Add to `infra/PROD-SMOKE.md`:

- **0. Create two engagements** via `/engagements/new` as platform_admin.
- **1. Cross-engagement isolation** — sign into A, then to B; row counts differ;
  the database also enforces it (sample test: SET app.engagement_id=999; SELECT
  FROM pbc_items; → 0 rows).
- **2. Per-engagement blob** — upload evidence to A, list
  `evidence-<a_id>` container, confirm not present in
  `evidence-<b_id>`.

## Risk + rollout

- **Risk:** a missed query keeps returning rows from another engagement until
  RLS is on. Mitigation: enable RLS strict in the **same commit** as the
  repo+route refactor. Either everything lands together or rollback.
- **Rollback:** revert the merge commit; migration `0004` is additive so it
  doesn't need to be rolled back. `0005` (RLS) does — keep its `DROP POLICY`
  rollback handy.

## Estimated effort

Realistically 6-10 hours of focused work for someone who's been in this
codebase, plus 1-2 hours of testing. Don't squeeze it into a long Slack
session — a fresh focused block is much safer for the kind of careful
mechanical change this is.
