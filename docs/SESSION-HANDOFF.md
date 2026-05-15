# Session handoff — 2026-05-14

This is the running notebook for the audit-tracker project. Read this first at
the start of a new session so you know what shape the system is in and what's
next. (Supersedes the earlier 2026-05-14 entry — the RLS/drift-check session;
prior sessions are summarised below.)

## TL;DR

The app is a deployed, multi-tenant IT-audit platform: templates, an admin
panel, role-tailored UX, the firm's real audit programme seeded in, Postgres
Row-Level Security enforcing engagement isolation, and — as of this session —
a **restyled UI**, a **decluttered PBC experience**, **4 new security audit
categories**, and **entity-scoped PBC items** (the audit adapts per legal
entity in scope).

Live at: **https://app-audit-audit1-prod.azurewebsites.net**
Running `ghcr.io/mikalesm/audit-tracker:a653e64` — **prod has NOT been
redeployed this session.** This session's work is on **PR #9**, not yet merged.

The platform_admin is **`mihai.cotocel@carpa-tech.com`** (set via
`AUDITOR_LEAD_BOOTSTRAP_EMAILS` app setting).

Prod's default seeded engagement is **`audit1`** (id=1), still empty.

**⚠️ Workflow change:** the PR flow is now **enforced** — a direct push to
`main` is blocked by the harness. This session shipped via **PR #9**
(`claude/entity-scoped-audit-and-ui`). The prior handoff's "commit straight to
main" note is no longer accurate. CI gates every push/PR; deploys still go
through `deploy.yml` (manual / tag — never on push or merge).

## Where this session's work lives

- **Branch:** `claude/entity-scoped-audit-and-ui`
- **PR:** https://github.com/mikalesm/audit-tracker/pull/9 (open, not merged)
- **Commit:** `376d63d` — 45 files, +1195/−563
- **New DB migration:** `0008_pbc_entity_scope.sql` — applies automatically on
  container start (`entrypoint.sh` → `migrate-startup.mjs`). No manual step.

## What still needs doing (immediately)

1. **Grant `User.Read.All` (Application) to the Audit Tracker Entra app
   registration** (`698e870e-9465-4bf3-b9fd-7307e4aa1ae5`) and click
   "Grant admin consent". Without this, the new Entra directory picker on the
   Members page silently falls back to plain email entry (it's defensive — no
   crash). With it, auditors get tenant-wide search/autocomplete.
2. **Review + merge PR #9** (and PR #10 — handoff doc; and any newer PR for the
   templates/members session). Test plans are in each PR description.
3. **Deploy to Azure** once merged — `deploy.yml` does not auto-run on merge;
   trigger it manually (see "How to redeploy" below). Migration `0008` applies
   on container start.
4. **Prod day-one steps are still pending** (untouched this session — they need
   doing on the *prod* `audit1` instance, this session worked against a local
   `demo` engagement):
   1. Create the first template (Switch ▾ → Platform admin → Templates → + New).
   2. Create the first real client audit from that template (Switch ▾ → + New audit).
   3. Invite a B2B colleague to verify the client experience.

## What was done this session (2026-05-14, PR #9)

A large UI + feature pass. Five themes, one commit (`376d63d`):

| Theme | What shipped |
| --- | --- |
| **Visual restyle** | Refined design tokens in `tailwind.config.ts` (softer `rule` border, `rule-strong`, `shadow-card`/`shadow-pop` scale, calmer `canvas`); polished shared primitives (`Card`/`Button`/`Badge`/`Input`/`Select`); slimmed help banners (`HelpStrip`/`HelpPanel` → quiet collapsibles); restyled `Shell` header (taller, responsive `wide:` breakpoint, **Settings moved into the account menu**), dashboard, and `KPIStrip`. |
| **PBC declutter** | `ContextSection` stripped of teaching `caption` + audience-chip noise (only `audience="internal"` renders a marker, reworded "Audit team only"). `PBCDetailPanel` regrouped into **Request / Workflow / Audit & references**; duplicated title + header status badges removed; list cards slimmed. |
| **Client experience** | `ClientDashboard`: pending-items fallback (shows all outstanding when nothing is owner-assigned), **category accordion**, Overall-progress moved to top, vibrant **"Start here" priority focus band**. `PBCDetailPanel` for clients: prominent upload CTA, audit-team-only sections hidden, and a trimmed **"Your task"** box (Status + Owner + read-only Priority — no internal tracking fields). |
| **Audit content** | 4 new categories in `src/lib/templates/library.ts` — **Endpoint & MDM, Security Posture, Cloud Security Posture, AI Governance** — 33 PBC items total. Library is now 88 items / 14 categories. `Category` union + `CATEGORIES` updated. |
| **Entity-scoped PBC** | See the section below. |

Also done (local only, not in the PR): created a local `demo` engagement and a
client user `client@example.test` for testing the client experience.

### Follow-up landed in a separate PR (templates + members)

After PR #9 merged we noticed two gaps and shipped fixes in a follow-up PR:

| Theme | What shipped |
| --- | --- |
| **Templates menu** | `NewTemplateForm.tsx` was hardcoding the original 10 PBC categories — the 4 new security categories were not selectable when creating a template. Now imports the canonical `PBC_CATEGORIES` from `library.ts` (auto-stays in sync) and the explainer mentions per-entity instantiation. |
| **Member invite bugfix** | `findOrCreatePlaceholderUser` creates a placeholder row keyed on `entra_object_id = 'pending::<email>'`, but `upsertUserOnSignIn` only matched on `entra_object_id` — so the real Entra OID never matched the placeholder and any email-invite was silently orphaned. `upsertUserOnSignIn` now adopts a pending placeholder by email before INSERT, preserving the membership rows. |
| **Entra directory picker** | New `src/lib/graph.ts` (app-only `ClientSecretCredential`, reuses the NextAuth `AZURE_AD_*` env vars) + `GET /api/admin/entra-users?q=…`. The Members page Add-Member form gained a typeahead that searches the firm's tenant directory by displayName / mail / UPN (incl. B2B Guests). Gracefully degrades to plain email entry when Graph isn't configured (local dev) or the tenant lacks the required permission. |
| **Members UX** | `MembersTable.tsx` now has a Single ↔ Bulk toggle (paste comma/newline-separated emails to invite many at once with a shared role), a per-member "Pending sign-in" pill (placeholder OID prefix) vs "Last seen <date>", role descriptions inline, and the listing now surfaces the user's display name above their email. `listEngagementMembers` returns `entraObjectId` and `lastSeenAt`. |

## Entity-scoped PBC items — how it works

Migration **`0008_pbc_entity_scope.sql`** adds two nullable columns to
`pbc_items`: `entity_id BIGINT REFERENCES entities(id) ON DELETE SET NULL`
(NULL = group-wide) and `template_key TEXT` (stable slug → library item).

- **Library** (`src/lib/templates/library.ts`): every `LibraryPBCItem` now
  carries `scope: 'group' | 'entity'` and `templateKey`, derived from
  `DEFAULT_SCOPE_BY_CATEGORY` + `SCOPE_OVERRIDES`. Per-entity templates ≈ the
  Entities & Systems inventories (network/app/asset/domain), all of Access
  Management, and Physical & Environmental. Everything else is group-wide.
- **Seeding** (`engagements.ts`): `seedFromLibrary` now inserts entities first,
  then calls the exported `seedPbcItems(tx, engagementId, entityRows, selection)`
  — group items get one row, per-entity items get one row **per in-scope
  entity** (`in_scope='Y'`). `copyTemplateRows` remaps `entity_id` via an
  old→new entity-id map.
- **Re-sync** (`pbc.ts`): `syncPbcEntityScope(engagementId, userId?)` —
  idempotent, **create-only**. Backfills `template_key` on legacy rows, then
  ensures every per-entity template has one instance per in-scope entity.
  Exposed at `POST /api/entities/sync-pbc` and triggered by the **"Generate
  per-entity PBC items"** button on the Entities page.
- **UI**: `EntityFilter` is now a *real* filter (was a cosmetic text-search) —
  `state.tsx` context exposes `entityId`; `PBCView` filters
  `entityId == null || i.entityId === entityId || i.entityId === null`. Per-entity
  items show a 🏢 entity chip on cards + table rows; `PBCDetailPanel` shows the
  entity in the header and has an editable Entity field (auditor-only) in the
  Workflow box.
- **`updatePBC`** guards against a cross-engagement `entity_id` (RLS scopes on
  `engagement_id`, not `entity_id`).
- **Not entity-scoped (deliberate, deferred):** walkthroughs, sampling,
  access requests.
- **`check-library-sync.ts`** updated — the 4 security categories are excluded
  from the workbook drift-check; `scope`/`templateKey` are library-only fields.

## RLS — how engagement isolation works at the DB layer

(Unchanged this session. Migration `0007_rls.sql` enables + **forces** RLS on
all 10 domain tables; the policy admits a row only when its `engagement_id`
equals the `app.engagement_id` session var.)

- **`withEngagement(id, fn)`** in `src/lib/db.ts` opens a transaction, sets the
  session var transaction-locally, installs an `AsyncLocalStorage`-scoped
  adapter. Every engagement-scoped API route + `page.tsx`/`layout.tsx` wrap in it.
- **`withBypassRls(fn)`** is the escape hatch for cross-engagement work
  (`createEngagement`, admin aggregates, migration runners).
- `entity_id` needs **no new RLS policy** — `engagement_id` RLS already scopes
  per-entity rows.
- **pglite does not enforce RLS** — local dev / CI Docker smoke test run on
  pglite and behave as before. Real enforcement is verified by the blocking
  `rls-isolation` CI job against a real Postgres container.

## Live state (prod)

```
Resource group:  rg-audit-audit1-prod         (Australia East)
App Service:     app-audit-audit1-prod
Image:           ghcr.io/mikalesm/audit-tracker:a653e64   (NOT yet updated for PR #9)
Postgres:        psql-audit-audit1-prod       (Entra auth, Managed Identity)
Storage:         stauditaudit1jj7wkn
Key Vault:       kv-audit-audit1-jj7wkn
Entra App Reg:   698e870e-9465-4bf3-b9fd-7307e4aa1ae5
Tenant:          ab9f6118-2f68-4594-b6cd-adbc16b9f239
```

Prod DB schema is at `0007_rls.sql`; `0008` applies on the next deploy. One
engagement: `audit1` (id=1).

## Local dev state

Local pglite (`data/pgdata/`, gitignored) has two engagements: `audit1` (id=1)
and **`demo`** (id=2) — `demo` is seeded under the new entity-scoped model
(5 entities, 2 in scope → 101 PBC items, 26 per-entity instances).
`.env.local` (gitignored) has `AUTH_DEV_BYPASS=1` +
`AUDITOR_LEAD_BOOTSTRAP_EMAILS=auditor@example.test` + a dev `NEXTAUTH_SECRET`.
Dev sign-in: `auditor@example.test` (platform_admin) or `client@example.test`
(client_owner on `demo`). `scripts/reseed-demo-pbc.ts` rebuilds `demo`'s
entities + PBC; restart `npm run dev` after running it (pglite is single-process).

## Outstanding / next priorities

1. **Review + merge PR #9, then deploy.**
2. **Group-vs-entity classification review.** The `scope` tags in `library.ts`
   are a sensible first pass; an auditor may want to retune which templates are
   per-entity. Per-item overrides are possible via the detail panel.
3. **Extend entity-scoping to walkthroughs / sampling** if wanted (deliberately
   out of scope for PR #9).
4. **Rewrite the Playwright e2e suite for multi-tenant** — still non-blocking,
   2 passing + 7 skipped placeholders.
5. **Front Door + WAF + private endpoints** — Bicep keeps
   `publicNetworkAccess=Enabled` (`infra/workload.bicep`).
6. **Activity-log retention** — no auto-purge.
7. **CI action versions** — Node 20 actions flagged for forced Node 24
   migration on 2026-06-02; bump before then.

## How to redeploy after a future change

```bash
# az is NOT installed locally — deploy.yml does the Azure work via OIDC
gh workflow run deploy.yml -R mikalesm/audit-tracker --ref main
gh run watch -R mikalesm/audit-tracker $(gh run list -R mikalesm/audit-tracker \
  --workflow=deploy.yml --limit 1 --json databaseId --jq '.[0].databaseId')

curl -sS https://app-audit-audit1-prod.azurewebsites.net/api/healthz | jq .
```

`deploy.yml` builds + pushes the image, logs into Azure via OIDC, repoints the
App Service, restarts, and smoke-tests `/api/healthz`. Migrations (incl. `0008`)
run on container start via `entrypoint.sh` → `migrate-startup.mjs`.

## Reference: file map

```
src/
├── app/
│   ├── page.tsx / layout.tsx          # server components — wrapped in withEngagement
│   ├── pbc/PBCView.tsx                # list (cards + table), real EntityFilter, entity chips
│   ├── pbc/PBCDetailPanel.tsx         # slide-over — 3 groups, entity field, client "Your task" box
│   ├── entities/EntitiesView.tsx      # entity table + "Generate per-entity PBC items" button
│   ├── engagements/ admin/            # picker, members, platform-admin pages
│   └── api/
│       ├── pbc/ entities/                  # entity-scoped routes wrap in withEngagement
│       ├── entities/sync-pbc/route.ts      # POST → syncPbcEntityScope
│       └── admin/entra-users/route.ts      # GET ?q=… → searchEntraUsers via Graph  (NEW)
├── components/
│   ├── shell/                        # Shell, EntityFilter, state.tsx (entityId context)
│   ├── dashboard/                    # Dashboard (auditor), ClientDashboard (client)
│   └── ui/                           # Card/Button/Badge/Input/Select, ContextSection, Help*
├── lib/
│   ├── db.ts                         # withEngagement / withBypassRls / getDb, DbAdapter
│   ├── graph.ts                      # Microsoft Graph user search (app-only ClientSecretCredential)  (NEW)
│   ├── templates/library.ts          # in-code master library — scope + templateKey on PBC items
│   ├── repository/
│   │   ├── engagements.ts            # seedFromLibrary / seedPbcItems / copyTemplateRows; listEngagementMembers returns entraObjectId + lastSeenAt
│   │   ├── users.ts                  # upsertUserOnSignIn now adopts a pending::<email> placeholder
│   │   └── pbc.ts                    # listPBC/updatePBC + syncPbcEntityScope
│   └── migrations/
│       ├── 0001 … 0007               # baseline → multitenant → templates → RLS
│       ├── 0008_pbc_entity_scope.sql # entity_id + template_key on pbc_items
│       └── runner.ts
├── scripts/
│   ├── check-library-sync.ts         # npm run check:library — drift-check (security cats excluded)
│   ├── reseed-demo-pbc.ts            # one-off: rebuild local demo's entities + PBC  (NEW)
│   └── test-rls-isolation.ts         # npm run test:rls
data/templates/IT_Audit_PBC_Tracker_v2.xlsx   # authoritative audit programme (55 of the 88 items)
.github/workflows/ci.yml               # build + check:library + rls-isolation + e2e
.github/workflows/deploy.yml           # manual / tag — Azure deploy via OIDC
```

## Prior sessions (summary)

- **2026-05-14 (earlier, direct-to-main):** CI library drift-check
  (`check-library-sync.ts`) + Postgres Row-Level Security (`0007_rls.sql`,
  `withEngagement`/`withBypassRls`, `rls-isolation` CI job).
- **2026-05-13 and earlier (PRs #1–#8):** rescued the live deploy (Azure was
  silently on in-memory pglite); built multi-tenancy (engagements, memberships,
  per-engagement `engagement_id` + blob containers); RBAC per request;
  platform-admin pages; engagement templates + the in-code library; role-tailored
  UX; seeded the firm's real audit programme from the committed Excel workbook.

## Open questions to confirm next session

- Is `audit1` going to be archived once a real client engagement exists, or
  kept as a sandbox?
- Should walkthroughs / sampling also become entity-scoped?
- Does the group-vs-entity `scope` classification in `library.ts` match how the
  firm actually runs multi-entity audits?
