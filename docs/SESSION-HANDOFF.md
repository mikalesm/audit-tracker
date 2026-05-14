# Session handoff — 2026-05-14

This is the running notebook for the audit-tracker project. Read this
first at the start of a new session so you know what shape the system
is in and what's next.

## TL;DR

The app is a working multi-tenant audit-tracker (PBC items, walkthroughs,
access requests, entities, sampling) with templates, an admin panel, and a
deployed live instance at:

**https://app-audit-audit1-prod.azurewebsites.net**

The deployed image is still `ghcr.io/mikalesm/audit-tracker:c5281cc` (latest
`main`). **PRs #1–#6 are merged on `main`. PR #7 (this handoff doc) merged.
PR #8 is OPEN and not yet deployed** — it's the current line of work.

This session was all on branch **`claude/redesign-audit-ui-79Fw0`** → **PR #8**.

The platform_admin is **`mihai.cotocel@carpa-tech.com`**. The default seeded
engagement is **`audit1`** (id=1, not a template).

## What was done this session (PR #8 — two commits, not yet merged)

PR #8 = "explanation-first audit UI redesign" + "seed from the real audit
programme". Two commits on `claude/redesign-audit-ui-79Fw0`:

### Commit `2c4f1f7` — explanation-first UI redesign
The complaint was "UI is not easy to navigate; each request needs an
explanation." Changes:

- **New primitives**:
  - `src/components/ui/ContextSection.tsx` — labelled detail block with a
    Client / Internal / Shared audience chip.
  - `src/components/ui/HelpStrip.tsx` — slim dismissible "what is this page?"
    banner (per-surface, remembered in localStorage).
  - `src/components/tables/ViewToggle.tsx` — Cards ↔ Table toggle +
    `useViewMode(storageKey)` hook (localStorage-persisted).
- **PBC** (`src/app/pbc/PBCView.tsx`, `PBCDetailPanel.tsx`): Cards view is now
  the default (one-line `whyPurpose` preview); dense Table view kept behind
  the toggle. Detail panel restructured into ContextSection blocks (*The ask ·
  Why we need it · What good looks like · Workflow · TSC mapping · Notes ·
  Linked items*) with audience indicators + a "missing context" warning for
  auditors.
- **Walkthroughs** (`src/app/walkthroughs/WalkthroughsView.tsx`): migration
  **0006** added `description` + `objective` columns. Cards view + a real
  ContextSection-based detail panel. Week view preserved.
- **Access** (`src/app/access/AccessView.tsx`): brand-new detail panel (didn't
  exist before) + Cards view.
- **Entities / Sampling**: HelpStrip banners + role-aware empty states.
- **Shell nav** (`src/components/shell/Shell.tsx`): per-group descriptions
  (desktop tooltip + mobile drawer helper text) and per-link hints.
- **Auditor Dashboard**: first-run hero on an empty engagement.

### Commit `8c52a91` — seed from the real audit programme
The user supplied the authoritative workbook `IT_Audit_PBC_Tracker_v2.xlsx`.
The in-code library was a generic placeholder; it's now the real programme:

- **`data/templates/IT_Audit_PBC_Tracker_v2.xlsx`** — the workbook is now
  committed to the repo as the canonical source of truth.
- **`src/lib/templates/library.ts`** rewritten with the real content,
  transcribed verbatim: **55 PBC items** (per-category 7/6/7/5/7/4/5/7/5/2),
  **19 access requests**, **11 walkthroughs**, **16 sampling controls**.
  Entities stay as 5 illustrative examples (the workbook's Entity Scope sheet
  is a blank per-client template).
- Walkthroughs in the library carry an **authored `description` + `objective`**
  for each of the 11 process areas (the spreadsheet has neither — this is the
  "make it human" enrichment).
- **`DEFAULT_TSC_BY_CATEGORY`** moved into `library.ts` as the single source of
  truth; `src/lib/excel/import.ts` now imports it instead of keeping a private
  copy. PBC `tscMapping` is derived per-category from it.
- **`CATEGORY_COVERAGE`** (library.ts, from the workbook's Categories sheet) +
  **`STATUS_HELP`** (src/lib/utils.ts, from the Cover sheet's status legend)
  are surfaced as **tooltips** — hover any status pill (`badge.tsx`) or PBC
  category (cards / table / detail panel) to see what it means.
- **Excel round-trip**: `export.ts` now emits the walkthrough
  Description/Objective columns; `import.ts` reads them if present and the
  walkthrough block now **upserts** (was INSERT-only) so a re-sync overlays
  structural columns onto existing rows.
- `npm run import` now defaults to `data/templates/IT_Audit_PBC_Tracker_v2.xlsx`.

## What still needs doing (immediately)

Pick up here in the next session:

1. **Get PR #8 reviewed / merged, then deploy.** It is not on `main` and not
   deployed. After merge, follow the redeploy drill below. The deployed image
   is still `c5281cc` — none of the PR #8 UX or content is live yet.
2. **Run migration 0006 on deploy.** `entrypoint.sh` runs migrations on
   startup, so a redeploy applies `0006_walkthrough_context.sql` automatically
   — but verify `/api/healthz` after, and confirm the Walkthroughs page shows
   the new description/objective fields.
3. **Re-seed `audit1` (or a fresh engagement) from the new library.** The live
   `audit1` engagement is still empty / has old content. Either create a
   template via `/admin/templates/new` (now seeds the real 55-item programme)
   or `npm run import` against an engagement.
4. **CI note**: `tsc` is clean on all changed files. The only `tsc` error is a
   pre-existing `Cannot find module 'xlsx'` — the `xlsx` dep is pulled from
   `cdn.sheetjs.com`, which is blocked in the Claude Code sandbox. CI on
   GitHub has full network access and should be fine; if CI ever fails on
   `xlsx`, that's an environment issue, not a code issue.

## Live state

```
Resource group:  rg-audit-audit1-prod         (Australia East)
App Service:     app-audit-audit1-prod
Image:           ghcr.io/mikalesm/audit-tracker:c5281cc  (latest MERGED main)
Postgres:        psql-audit-audit1-prod       (Entra auth, Managed Identity)
Storage:         stauditaudit1jj7wkn          (one container per engagement)
Key Vault:       kv-audit-audit1-jj7wkn       (NEXTAUTH_SECRET + AAD client secret)
Entra App Reg:   698e870e-9465-4bf3-b9fd-7307e4aa1ae5  ("Audit Tracker (audit1)")
Tenant:          ab9f6118-2f68-4594-b6cd-adbc16b9f239
```

App settings on the App Service (besides what Bicep handles):

- `AUDITOR_LEAD_BOOTSTRAP_EMAILS=mihai.cotocel@carpa-tech.com`
- `AUTH_TRUST_HOST=true`
- `AZURE_AD_CLIENT_ID`, `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_SECRET`
- `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGSSLMODE`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`

**DB schema on `main` is at `0005_engagement_templates.sql`.** PR #8 adds
`0006_walkthrough_context.sql` (additive: `walkthroughs.description` +
`walkthroughs.objective`, both nullable, no backfill) — applied on next
deploy.

## Outstanding / next priorities

Roughly in importance order. Each is plausibly a single-session focused PR.

1. **Merge + deploy PR #8** (see "immediately" above).
2. **Postgres RLS hardening.** Documented as TODO in `docs/ISOLATION.md`. New
   migration to enable RLS on every domain table + `withEngagement(id, fn)` in
   `db.ts` that `SET LOCAL`s the session var inside a transaction.
3. **Rewrite the Playwright e2e suite for multi-tenant.** Currently
   non-blocking in CI with 2 passing + 7 skipped placeholders.
4. **Front Door + WAF + private endpoints.** Bicep keeps
   `publicNetworkAccess=Enabled` today.
5. **Linked-items picker polish** — the picker exists but is cramped.
6. **Activity-log retention** — no auto-purge yet.
7. **Optional: extend engagement Settings** to capture the workbook's Cover
   sheet metadata the portal doesn't model yet (reporting deadline, engagement
   partner, client IT contact, entities-in-scope, in-scope frameworks).

## How to redeploy after merging a future PR

```bash
gh auth login   # if Cloud Shell is fresh
SHA=$(curl -s https://api.github.com/repos/mikalesm/audit-tracker/commits/main \
  | grep -m1 '"sha"' | cut -d'"' -f4 | cut -c1-7)
gh workflow run deploy.yml -R mikalesm/audit-tracker -f tag=$SHA --ref main
gh run watch -R mikalesm/audit-tracker

az webapp config container set -g rg-audit-audit1-prod -n app-audit-audit1-prod \
  --container-image-name ghcr.io/mikalesm/audit-tracker:$SHA
az webapp restart -g rg-audit-audit1-prod -n app-audit-audit1-prod

sleep 90
curl -sS https://app-audit-audit1-prod.azurewebsites.net/api/healthz | jq .
```

Expected healthz: `{"ok": true, "engine": "postgres", "degraded": false}`.

## Reference: file map

```
src/
├── app/
│   ├── page.tsx                      # role-branches: ClientDashboard vs Dashboard
│   ├── pbc/
│   │   ├── PBCView.tsx               # Cards/Table toggle, HelpStrip, category tooltips
│   │   └── PBCDetailPanel.tsx        # ContextSection blocks + audience chips
│   ├── walkthroughs/WalkthroughsView.tsx  # Cards/Table/Week, ContextSection detail panel
│   ├── access/AccessView.tsx         # Cards/Table + new detail panel
│   ├── entities/EntitiesView.tsx     # HelpStrip + empty state
│   ├── sampling/SamplingView.tsx     # HelpStrip + empty state
│   ├── settings/SettingsView.tsx     # per-section Save buttons
│   ├── engagements/ ...              # picker, new, members
│   ├── admin/ ...                    # overview, engagements, templates, users
│   └── api/ ...                      # every domain route: requireRole → engagement-scoped repo
├── components/
│   ├── shell/Shell.tsx               # NAV_GROUPS w/ descriptions + per-link hints
│   ├── dashboard/{Dashboard,ClientDashboard,HelpPanel}.tsx
│   ├── tables/{InlineEdit,SavedIndicator,ViewToggle}.tsx
│   └── ui/{card,badge,button,input,select,ContextSection,HelpStrip}.tsx
├── lib/
│   ├── db.ts                         # AAD token callback for pg.Pool
│   ├── rbac.ts                       # getActor / requireRole / requirePlatformAdmin
│   ├── auth.ts / auth.config.ts      # NextAuth v5 + dev-bypass + B2B normalization
│   ├── blob.ts                       # containerNameFor(engagementId)
│   ├── utils.ts                      # STATUSES, STATUS_HELP, STATUS_COLORS, etc.
│   ├── templates/library.ts          # REAL audit programme; DEFAULT_TSC_BY_CATEGORY, CATEGORY_COVERAGE
│   ├── excel/{import,export,run-import}.ts  # round-trips walkthrough description/objective
│   └── repository/
│       ├── engagements.ts            # createEngagement, copyTemplateRows, seedFromLibrary
│       └── ...                       # one per domain, all take engagementId first
├── lib/migrations/
│   ├── 0001_baseline.sql … 0005_engagement_templates.sql
│   └── 0006_walkthrough_context.sql  # NEW in PR #8: walkthroughs.description + objective
└── scripts/
    ├── entrypoint.sh                 # Docker CMD; mints AAD token, runs migrations
    └── migrate-startup.mjs

data/
└── templates/IT_Audit_PBC_Tracker_v2.xlsx  # NEW: canonical source workbook

docs/
├── ISOLATION.md                      # multi-tenant boundary contract
├── PHASE_C_MULTITENANT_PLAN.md       # historical
└── SESSION-HANDOFF.md                # this file
```

## Open questions to confirm next session

- Is `audit1` going to be archived once a real client engagement exists, or
  kept as a sandbox? (Still open from last session.)
- Do you want Phase G (RLS) before or after rewriting e2e?
- Should the Cover-sheet metadata (reporting deadline, engagement partner,
  client IT contact, etc.) become first-class engagement Settings fields?
