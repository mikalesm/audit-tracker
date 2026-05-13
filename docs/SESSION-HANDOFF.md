# Session handoff — 2026-05-13

This is the running notebook for the audit-tracker project. Read this
first at the start of a new session so you know what shape the system
is in and what's next.

## TL;DR

The app went from "stuck single-tenant deploy returning 5xx" to a working
multi-tenant master with templates, an admin panel, role-tailored UX,
and a deployed live instance at:

**https://app-audit-audit1-prod.azurewebsites.net**

Currently running `ghcr.io/mikalesm/audit-tracker:c5281cc` (latest `main`).

Six PRs merged this session: **#1 → #6**. All sit on `main`.

The platform_admin is **`mihai.cotocel@carpa-tech.com`** (set via
`AUDITOR_LEAD_BOOTSTRAP_EMAILS` app setting).

The default seeded engagement is **`audit1`** ("Audit 1 · Client Name ·
FY2026"). It's currently empty — no PBC items, no walkthroughs, no
templates created yet.

## What still needs doing (immediately)

Pick up here in the next session:

1. **Create the first template.** Sign in → header → Switch ▾ → Platform
   admin → → **Templates** → **+ New template**. All ten PBC categories
   and four sheets are ticked by default; click Create. You land in the
   template engagement. Optionally overlay your own Excel via Settings →
   Re-sync from Excel.
2. **Create the first real client audit.** Header → Switch ▾ → **+ New
   audit**. Fill in client name, fiscal year, slug. Pick the template
   you just made in **Use template**. Submit.
3. **Invite a B2B-style colleague to that audit** to verify the client
   experience: `/engagements/<slug>/members` → add by email → Contributor
   role. Sign in as them in a private window — you should land on the
   new client-tailored dashboard.

The `audit1` engagement can stay as a sandbox or be archived from
`/admin/engagements` once the first real client audit exists.

## What was done this session

Chronological:

| PR | What it shipped |
| --- | --- |
| **#1** (Phase 1+2) | Rescued the live deploy — Azure was silently running in-memory pglite because Bicep never assembled `DATABASE_URL`. Added entrypoint script that mints an AAD token and runs migrations against real Postgres. First-user privilege escalation gated by `AUDITOR_LEAD_BOOTSTRAP_EMAILS`. B2B guest UPN handling. healthz reports the engine + 503s if pglite ever sneaks into Azure. Migration 0003 added `users.upn`. Migration 0004 introduced engagements + memberships + per-table `engagement_id` (additive). Several CI fix iterations (tsc/e2e exclude, Dockerfile EACCES, `trustHost: true`, middleware bypass for healthz, GHCR pull credentials). |
| **#2** (Phase C) | Multi-tenant cutover. Every repo function now takes `engagementId` and filters every query. `logActivity` / `logAccess` carry it. Per-engagement blob containers `evidence-eng-<id>`. `rbac.ts` rewritten: cookie + DB membership re-validated on every request. New routes: `/api/engagements` (list/create), `/api/engagements/[slug]/switch`, `/api/engagements/[slug]/members`. New pages: `/engagements`, `/engagements/new`, `/engagements/[slug]/members`. Shell got the engagement switcher. Bootstrap: a fresh platform_admin is auto-added as `auditor_lead` to any engagement without a lead. |
| **#3** (Phase D) | Platform admin pages. `/admin` overview, `/admin/engagements` (list, change status, "join as lead"), `/admin/users` (toggle `platform_admin`, deactivate). Tightened `/api/engagements/[slug]/switch` so even platform_admin must be a member to switch into an engagement. `docs/ISOLATION.md` documents the cross-engagement isolation contract. |
| **#4** (Phase E) | Engagement templates. Migration 0005 adds `is_template` boolean. `copyTemplateRows` clones an existing engagement's structural rows. `/admin/templates` list + create page. `/engagements/new` got a "Use template" dropdown. Per-engagement blob container reinforcement (`containerNameFor` rejects non-positive IDs). |
| **#5** (Phase F) | In-code template library. `src/lib/templates/library.ts` carries ~50 PBC items across 10 categories, 12 access requests, 9 walkthroughs, 5 entities, 12 sampling controls. New-template form has ten category checkboxes + four sheet toggles (Access/Walkthroughs/Entities/Sampling). `/admin/templates` table gained a Categories column. Dropdown labels now show item count + category count. |
| **#6** (Phase H) | UX overhaul. Header nav grouped: **Workspace · Scope · Audit · Admin** with thin vertical separators and a hamburger drawer below `md`. New `ClientDashboard` for client_owner/client_reviewer with "How this works" help, "What you need to upload", overdue alert, upcoming walkthroughs. Internal Comments tab hidden for clients. `useDirtyForm` hook + `CardFooter` slot. Settings has explicit **Save changes** buttons per section, Discard link, Unsaved-changes warning, beforeunload guard, and `router.refresh()` on success. Excel import also refreshes. Empty states on PBC + Walkthroughs are role-aware. |

## Live state

```
Resource group:  rg-audit-audit1-prod         (Australia East)
App Service:     app-audit-audit1-prod
Image:           ghcr.io/mikalesm/audit-tracker:c5281cc  (latest main)
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

DB schema is at migration `0005_engagement_templates.sql`. Migrations
0001 → 0005 all applied. One engagement: `audit1` (id=1, not a template).

## Outstanding / next priorities

Roughly in importance order. Each one is plausibly a single-session
focused PR.

1. **Postgres RLS hardening.** Documented as TODO in `docs/ISOLATION.md`.
   The application-side `WHERE engagement_id = $N` filtering is consistent
   today, but RLS as belt-and-suspenders means a future missing WHERE
   can't leak across engagements. Needs a new migration that enables RLS
   on every domain table, plus `withEngagement(id, fn)` in `db.ts` that
   `SET LOCAL`s the session var inside a transaction.
2. **Rewrite the Playwright e2e suite for multi-tenant.** Currently
   non-blocking in CI with 2 passing + 7 skipped placeholders. Should
   cover: platform_admin creates two engagements → seeds from templates
   → confirms isolation (no cross-read) → invites members → role enforcement.
3. **Real Excel content overlay.** The library shipped in PR #5 is a
   generic IT-audit starter. The user has a proprietary Excel
   (`IT_Audit_PBC_Tracker_v2.xlsx`) that should be loaded into templates
   for production use. Two paths:
   - One-off: open a template, Settings → Re-sync from Excel, upload it.
     The structural columns get overlaid.
   - Permanent: commit the workbook into `data/templates/` and add a
     "Load workbook" admin action that imports a chosen XLSX into a
     designated template by slug.
4. **Front Door + WAF + private endpoints.** Bicep keeps `publicNetworkAccess=Enabled`
   today (see `infra/workload.bicep`). For higher-stakes audits this
   should tighten.
5. **Linked-items picker polish.** Mentioned as a "rough edge" in
   README from the original codebase — the picker exists but is cramped.
6. **Activity-log retention.** No auto-purge. If retention policy says
   "evict access_log rows older than N months," add a periodic Job /
   trigger to enforce it.

## How to redeploy after merging a future PR

Same drill as the one I just walked through:

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

The bits of the codebase the next session will most often touch:

```
src/
├── app/
│   ├── page.tsx                      # role-branches: ClientDashboard vs Dashboard
│   ├── pbc/
│   │   ├── PBCView.tsx               # reads /api/me to know role; passes to detail panel
│   │   └── PBCDetailPanel.tsx        # Internal Comments tab gated by role
│   ├── walkthroughs/WalkthroughsView.tsx
│   ├── settings/SettingsView.tsx     # per-section Save buttons via useDirtyForm
│   ├── engagements/
│   │   ├── page.tsx                  # picker + "Platform admin" link for admins
│   │   ├── new/{page,NewEngagementForm}.tsx
│   │   └── [slug]/members/
│   ├── admin/
│   │   ├── page.tsx                  # overview + storage isolation panel
│   │   ├── engagements/{page,AdminEngagementsTable}.tsx
│   │   ├── templates/{page,AdminTemplatesTable}.tsx
│   │   ├── templates/new/{page,NewTemplateForm}.tsx   # category checkboxes
│   │   └── users/{page,AdminUsersTable}.tsx
│   └── api/
│       ├── engagements/route.ts                 # POST accepts librarySeed
│       ├── engagements/[slug]/{switch,members}/route.ts
│       ├── admin/{engagements,templates,users}/...
│       └── /* every domain route: requireRole(min) → actor.engagement.id passed to repo */
├── components/
│   ├── shell/Shell.tsx               # NAV_GROUPS, responsive header
│   ├── dashboard/{Dashboard,ClientDashboard,HelpPanel}.tsx
│   └── ui/card.tsx                   # CardFooter slot for Save buttons
├── lib/
│   ├── db.ts                         # AAD token callback for pg.Pool
│   ├── rbac.ts                       # getActor / requireRole / requirePlatformAdmin
│   ├── auth.ts                       # NextAuth v5 + dev-bypass + B2B normalization
│   ├── auth.config.ts                # edge-safe; trustHost: true
│   ├── blob.ts                       # containerNameFor(engagementId)
│   ├── forms/useDirtyForm.ts
│   ├── templates/library.ts          # in-code master library
│   └── repository/
│       ├── engagements.ts            # createEngagement, copyTemplateRows, seedFromLibrary
│       └── /* one per domain, all take engagementId first */
├── lib/migrations/
│   ├── 0001_baseline.sql
│   ├── 0002_users_rbac.sql
│   ├── 0003_user_upn.sql
│   ├── 0004_multitenant.sql
│   └── 0005_engagement_templates.sql
└── scripts/
    ├── entrypoint.sh                 # Docker CMD; mints AAD token, runs migrations
    └── migrate-startup.mjs           # standalone migration runner

docs/
├── ISOLATION.md                      # multi-tenant boundary contract
├── PHASE_C_MULTITENANT_PLAN.md       # historical, kept for reference
└── SESSION-HANDOFF.md                # this file

infra/
├── main.bicep / workload.bicep       # per-engagement RG; deploy.sh wraps
├── parameters.acme.json              # template params file
├── PROD-SMOKE.md                     # post-deploy manual checklist
└── RUNBOOK.md                        # original deploy runbook
```

## Open questions to confirm next session

- Do you want the proprietary Excel committed to the repo (option #3 in
  "Outstanding") or left to per-engagement upload?
- Do you want Phase G (RLS) before or after rewriting e2e?
- Is `audit1` going to be archived once a real client engagement exists,
  or kept as a sandbox?
