# Session handoff — 2026-05-14

This is the running notebook for the audit-tracker project. Read this first at
the start of a new session so you know what shape the system is in and what's
next. (Supersedes the 2026-05-13 entry; prior sessions are summarised below.)

## TL;DR

The app is a deployed, multi-tenant IT-audit platform: templates, an admin
panel, role-tailored UX, the firm's real audit programme seeded in, and now
**Postgres Row-Level Security** enforcing engagement isolation at the database.

Live at: **https://app-audit-audit1-prod.azurewebsites.net**
Currently running `ghcr.io/mikalesm/audit-tracker:a653e64` (latest `main`).

The platform_admin is **`mihai.cotocel@carpa-tech.com`** (set via
`AUDITOR_LEAD_BOOTSTRAP_EMAILS` app setting).

The default seeded engagement is **`audit1`** (id=1). It is still empty — no
template or real client audit has been created yet (see "immediately" below).

**Note on workflow:** this session committed directly to `main` (no PRs) —
that's the agreed flow for this repo. CI gates every push; deploys go through
the `deploy.yml` GitHub Actions workflow (`az` is not installed locally).

## What still needs doing (immediately)

The operational day-one steps are *still* not done — the platform is ready but
unused:

1. **Create the first template.** Sign in → header → Switch ▾ → Platform
   admin → **Templates** → **+ New template**. Categories/sheets are ticked by
   default; click Create. You land in the template engagement. The in-code
   library (the firm's real programme) seeds it; optionally overlay your Excel
   via Settings → Re-sync from Excel.
2. **Create the first real client audit.** Header → Switch ▾ → **+ New audit**.
   Fill in client name, fiscal year, slug. Pick the template in **Use template**.
3. **Invite a B2B colleague** to that audit (`/engagements/<slug>/members`) to
   verify the client experience in a private window.

Then verify the RLS change end-to-end in the browser (see below).

## What was done this session (2026-05-14)

Two changes, both committed straight to `main` and deployed:

| Commit | What it shipped |
| --- | --- |
| `9ddf347` | **CI library drift-check.** `src/lib/templates/library.ts` is a hand transcription of the authoritative `data/templates/IT_Audit_PBC_Tracker_v2.xlsx`; the two feed different seed paths and could silently diverge. Added `scripts/check-library-sync.ts` (`npm run check:library`), wired into CI, comparing every workbook-derived field. Extracted shared sheet-parsing into `src/lib/excel/sheet-utils.ts` so the check parses identically to the importer. The check immediately caught one drifted PBC row (a paraphrased `whyPurpose`), now corrected. |
| `b3fffb4` + `a653e64` | **Postgres Row-Level Security.** RLS as a fail-closed second layer behind the application-side `WHERE engagement_id` filtering — see "RLS" section below. `a653e64` is a one-line follow-up fixing the CI test (Postgres returns BIGINT as a string). |

Also verified: the proprietary Excel workbook (open question from the prior
handoff) **is** committed and fully wired into both seed paths — that question
is closed.

## RLS — how engagement isolation now works at the DB layer

Migration **`0007_rls.sql`** enables + **forces** RLS on all 10 domain tables
(`pbc_items`, `access_requests`, `walkthroughs`, `entities`, `sampling_items`,
`evidence_files`, `settings`, `saved_views`, `activity_log`, `access_log`). The
policy admits a row only when its `engagement_id` equals the `app.engagement_id`
Postgres session variable; `WITH CHECK` blocks cross-engagement writes.

- **`withEngagement(id, fn)`** in `src/lib/db.ts` opens a transaction, sets the
  session var transaction-locally, and installs an `AsyncLocalStorage`-scoped
  adapter — so `getDb()` inside it transparently returns the scoped connection.
  **The 11 repository files were not changed.** Every engagement-scoped API
  route (22 of them) and the two server components that load engagement data
  (`page.tsx`, `layout.tsx`) are wrapped in it.
- **`withBypassRls(fn)`** is the request-unreachable escape hatch for genuinely
  cross-engagement work: `createEngagement` (reads a template, writes the new
  engagement) and `listAllEngagementsWithCounts` (admin aggregate). The
  migration runners (`runner.ts`, `migrate-startup.mjs`) set `app.bypass_rls`
  so migrations are exempt.
- **`FORCE` is required** because the app connects as the Postgres principal
  that owns the tables (it runs the migrations); without FORCE the owner
  bypasses RLS.
- **pglite does not enforce RLS** — local dev and the CI Docker smoke test run
  on pglite and behave exactly as before (the app-side `WHERE` still filters).
  Real enforcement is verified by the new **blocking `rls-isolation` CI job**,
  which runs migrations + cross-engagement assertions against a real Postgres
  service container, as a non-superuser table-owner role (mirroring prod). All
  7 assertions pass.

A path that forgets `withEngagement` will, on prod, see **zero rows**
(fail-closed) — a visible bug, never a cross-engagement leak.

**Not yet browser-verified:** `/api/healthz` only does `SELECT 1`, so it can't
confirm the RLS-wrapped data paths. Sign in and confirm the dashboard / PBC
list still load for an engagement. The route/page survey was exhaustive, but
this is the one check that couldn't be automated.

## Live state

```
Resource group:  rg-audit-audit1-prod         (Australia East)
App Service:     app-audit-audit1-prod
Image:           ghcr.io/mikalesm/audit-tracker:a653e64  (latest main)
Postgres:        psql-audit-audit1-prod       (Entra auth, Managed Identity)
Storage:         stauditaudit1jj7wkn          (one container per engagement)
Key Vault:       kv-audit-audit1-jj7wkn       (NEXTAUTH_SECRET + AAD client secret)
Entra App Reg:   698e870e-9465-4bf3-b9fd-7307e4aa1ae5  ("Audit Tracker (audit1)")
Tenant:          ab9f6118-2f68-4594-b6cd-adbc16b9f239
```

App settings set on the App Service (besides what Bicep handles):

- `AUDITOR_LEAD_BOOTSTRAP_EMAILS=mihai.cotocel@carpa-tech.com`
- `AUTH_TRUST_HOST=true`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET` (Entra app)
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE` (Bicep)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET` (Bicep + Key Vault)

DB schema is at migration `0007_rls.sql`. Migrations 0001 → 0007 all applied.
One engagement: `audit1` (id=1, not a template).

## Outstanding / next priorities

Roughly in importance order. Each is plausibly a single-session focused change.

1. **Rewrite the Playwright e2e suite for multi-tenant.** Still non-blocking in
   CI with 2 passing + 7 skipped placeholders. Should cover: platform_admin
   creates two engagements → seeds from templates → confirms isolation → invites
   members → role enforcement. (The new `rls-isolation` CI job already covers
   DB-level isolation; e2e would cover the UI/request layer.)
2. **Front Door + WAF + private endpoints.** Bicep keeps
   `publicNetworkAccess=Enabled` today (see `infra/workload.bicep`).
3. **Linked-items picker polish.** The picker exists but is cramped.
4. **Activity-log retention.** No auto-purge. If retention policy says "evict
   `access_log` rows older than N months," add a periodic Job / trigger.
5. **CI action versions.** GitHub flagged the Node 20 actions
   (`actions/checkout@v4`, `docker/*`) for forced migration to Node 24 on
   2026-06-02 — bump them before then.

(Postgres RLS hardening — the prior #1 — is done as of this session.)

## How to redeploy after a future change

```bash
# from a machine with gh authed (az is NOT needed — deploy.yml does the Azure work)
gh workflow run deploy.yml -R mikalesm/audit-tracker --ref main
gh run watch -R mikalesm/audit-tracker $(gh run list -R mikalesm/audit-tracker \
  --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')

curl -sS https://app-audit-audit1-prod.azurewebsites.net/api/healthz | jq .
```

`deploy.yml` builds + pushes the image, logs into Azure via OIDC, points the
App Service at the new image, restarts, and smoke-tests `/api/healthz`.
Expected: `{"ok": true, "engine": "postgres", "degraded": false}`.
Migrations run automatically on container start via `scripts/entrypoint.sh` →
`scripts/migrate-startup.mjs`.

## Reference: file map

The bits the next session will most often touch:

```
src/
├── app/
│   ├── page.tsx / layout.tsx          # server components — wrapped in withEngagement
│   ├── pbc/ walkthroughs/ settings/   # client views; data via /api/*
│   ├── engagements/ admin/            # picker, members, platform-admin pages
│   └── api/
│       └── /* every engagement-scoped route wraps its body in
│             withEngagement(actor.engagement.id, …); admin/auth/engagement-
│             management routes do not (they touch no RLS table) */
├── lib/
│   ├── db.ts                          # withEngagement / withBypassRls / getDb,
│   │                                  #   AsyncLocalStorage scope, PG + pglite adapters
│   ├── rbac.ts                        # getActor / requireRole / requirePlatformAdmin
│   ├── auth.ts                        # NextAuth v5 + dev-bypass + B2B normalization
│   ├── excel/
│   │   ├── import.ts / export.ts      # workbook round-trip
│   │   └── sheet-utils.ts             # shared xlsx parsing (importer + drift-check)
│   ├── templates/library.ts           # in-code master library (transcription of the xlsx)
│   ├── repository/                    # one file per domain; all take engagementId first,
│   │                                  #   call getDb() — unchanged by the RLS work
│   └── migrations/
│       ├── 0001 … 0006                # baseline → multitenant → templates → walkthrough ctx
│       ├── 0007_rls.sql               # enable + FORCE RLS, engagement-isolation policies
│       └── runner.ts                  # sets app.bypass_rls per migration
├── scripts/
│   ├── migrate-startup.mjs            # Docker CMD migration runner; sets app.bypass_rls
│   ├── check-library-sync.ts          # npm run check:library — CI drift-check
│   └── test-rls-isolation.ts          # npm run test:rls — real-Postgres RLS assertions
data/templates/IT_Audit_PBC_Tracker_v2.xlsx   # authoritative audit programme
docs/ISOLATION.md                      # the engagement-isolation contract (incl. RLS)
.github/workflows/ci.yml               # build + check:library + rls-isolation + e2e
```

## Prior sessions (summary)

- **2026-05-13 and earlier (PRs #1–#8):** rescued the live deploy (Azure was
  silently on in-memory pglite); built multi-tenancy (engagements, memberships,
  per-engagement `engagement_id` + blob containers); RBAC re-validated per
  request; platform-admin pages; engagement templates + the in-code library;
  UX overhaul (role-tailored dashboards, grouped nav, per-section save); seeded
  the firm's real audit programme from the committed Excel workbook.

## Open questions to confirm next session

- Is `audit1` going to be archived once a real client engagement exists, or
  kept as a sandbox?
- e2e rewrite vs. Front Door/WAF — which is the higher priority for the next
  focused session?
