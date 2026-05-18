# Audit Tracker — Project Overview

A complete reference for the application: purpose, architecture, infrastructure,
domain model, code layout, operational surface. Nothing sensitive (no keys,
secrets, customer names, tenant IDs, or live URLs) — only structure and intent.

---

## 1. Purpose

A secure shared workspace for an IT audit engagement (general IT controls, SOC 2
readiness, software licensing, IT spend). The same UI is used by the audit team
and by the auditee. It is intended as a **dataroom-grade single sheet** where
the client uploads evidence and both sides watch progress in real time, with
strict per-engagement isolation so a firm can run many concurrent audits
without cross-contamination.

Core jobs the product does:

- Track the **PBC ("Provided by Client") request list** — each row is a piece of
  evidence the auditor needs, with status, priority, owner, dates, evidence
  attachments, notes thread, internal comments, TSC mapping, and entity scope.
- Track **read-only access requests** the audit team needs into client systems.
- Plan and run **walkthroughs** (working sessions with the team that owns a
  control) — list view + week calendar.
- Manage **entity scope** (legal entities, in-scope / out-of-scope rationale,
  drives per-entity instantiation of PBC items).
- Manage **sampling and testing** populations + sample sizes per control.
- Capture every change in an **engagement-wide activity log**, attributed to a
  user.
- Generate **client-facing PDF reports** (one-page summary + full report,
  optionally filtered to SOC 2 TSC scope).
- Hold **firm-wide engagement templates** so a fresh audit starts pre-populated
  with the firm's standard programme.

---

## 2. Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS, Radix UI primitives, lucide-react icons, Recharts |
| Auth | NextAuth v5 with the Microsoft Entra ID provider |
| Database | PostgreSQL — `@electric-sql/pglite` (WASM) for local dev, Azure Database for PostgreSQL Flexible Server in production |
| DB driver | `pg` + a thin `DbAdapter` that swaps between pglite and a real `pg.Pool` |
| Blob storage | `@azure/storage-blob` + `@azure/identity` (Managed Identity in Azure; well-known emulator string locally) |
| PDF | `@react-pdf/renderer` (server-side rendering) |
| Excel I/O | SheetJS (`xlsx`) — pinned to the CDN tarball |
| Testing | Playwright (E2E), a custom RLS-isolation script |
| Container build | Docker (single Linux image) |
| Image registry | GitHub Container Registry (`ghcr.io`) |
| Infra-as-code | Bicep (one `main.bicep` + `parameters.<client>.json` per engagement) |
| CI/CD | GitHub Actions with OIDC federated identity to Azure |
| Runtime in prod | Azure App Service (Linux, container) |

---

## 3. Identity & authentication

- Sign-in is **Microsoft Entra ID** in production. Client users are invited as
  **B2B Guests** in the auditor's tenant; auditors sign in with their own work
  account. MFA is enforced by Conditional Access policies at the tenant level
  (not by the app).
- NextAuth is split across two files so the Edge middleware stays small:
  - `src/lib/auth.config.ts` — Edge-safe config used by `middleware.ts`.
  - `src/lib/auth.ts` — full Node config (providers, callbacks, adapters).
- Three auth modes are supported via environment variables (no code change):
  1. **Production** — `AZURE_AD_CLIENT_ID` set → real Entra sign-in.
  2. **Local dev with fake sign-in** — `AUTH_DEV_BYPASS=1`, any email becomes a
     fake user.
  3. **Open mode** — neither set → no sign-in, no role checks (useful for
     smoke tests only, never production).
- The **first user to sign in** is auto-promoted to `auditor_lead` so a fresh
  deployment is never bricked with no admin. An optional
  `auditorLeadBootstrapEmails` parameter pre-seeds additional admins on first
  contact.

### Roles

There are two layers of role:

- **System role** (`users.system_role`): `platform_admin` or `member`.
  Platform admins manage templates and engagement creation across the whole
  install; everything else is engagement-scoped.
- **Engagement role** (`engagement_memberships.role`): a per-engagement rank.

| Engagement role | Rank | Can |
| --- | --- | --- |
| `auditor_lead` | 4 | Everything in the engagement. Add/promote/demote members, re-import Excel, delete evidence, add ad-hoc questions/sections (see §7). |
| `auditor` | 3 | Read everything. Edit PBC / Access / Walkthroughs / Entities / Sampling. View engagement timeline. Generate reports. |
| `client_owner` | 2 | Read everything except internal comments + the engagement timeline. Edit Status / Owner / Dates / Notes on items they're assigned to. Upload evidence. |
| `client_reviewer` | 1 | Read-only (also no internal comments / timeline). |

RBAC is centralised in `src/lib/rbac.ts`:

- `getActor()` — resolves the authenticated user + their role in the currently
  selected engagement (read from the `audit_engagement` cookie).
- `requireAuth()` / `requireRole(min)` / `requirePlatformAdmin()` — guard
  helpers that every API route uses to short-circuit with 401 / 403 / 400.
- `hasRole(actor, min)` — rank-based comparison.

---

## 4. Multi-tenant isolation

A single deployment hosts many engagements, and a single Postgres database
holds the data for all of them. Isolation is **belt-and-braces**:

1. **Application filter**: every repository call scopes by `engagement_id`,
   resolved from the user's session cookie. There is no API path that takes a
   raw `id` without an `engagement_id` next to it.
2. **Row-Level Security** on every domain table (`0007_rls.sql`):
   - RLS is `ENABLED` and `FORCED` (FORCE is needed because the app connects as
     the table owner — without FORCE the owner bypasses RLS).
   - Policy: a row is visible only when its `engagement_id` matches the
     `app.engagement_id` session variable, which the app sets per transaction
     via `withEngagement(engagementId, …)` in `src/lib/db.ts`.
   - Missing scope → **zero rows** (fail-closed). A bug becomes a visible empty
     screen, never a cross-tenant leak.
   - `app.bypass_rls = 'on'` is an explicit, deliberate escape hatch for the
     handful of cross-engagement operations (creating a new engagement from a
     template, platform-admin aggregates). Set only by `withBypassRls()` and
     the migration runner.
3. **Per-engagement Azure Resource Group** in production — strong physical
   isolation if a customer requires it. The default deployment model creates
   `rg-audit-<client>-<env>` per engagement so one customer's blast radius is
   one RG.

An RLS-isolation test (`npm run test:rls`,
`scripts/test-rls-isolation.ts`) runs in CI and asserts that the policy is
fail-closed.

---

## 5. Database schema

Migrations live in `src/lib/migrations/`, are numbered, and are applied by
`src/lib/migrations/runner.ts` on app start. The current set:

| # | File | What it adds |
| --- | --- | --- |
| 0001 | `0001_baseline.sql` | Domain tables: `pbc_items`, `access_requests`, `walkthroughs`, `entities`, `sampling_items`, `activity_log`, `evidence_files`, `settings`, `saved_views`. |
| 0002 | `0002_users_rbac.sql` | `users`, system + engagement roles. |
| 0003 | `0003_user_upn.sql` | UPN tracking for Entra users. |
| 0004 | `0004_multitenant.sql` | `engagements`, `engagement_memberships`, adds `engagement_id` to every domain table, per-engagement uniqueness on `num`. |
| 0005 | `0005_engagement_templates.sql` | `is_template` flag on `engagements`; the template engagement holds the firm's standard programme. |
| 0006 | `0006_walkthrough_context.sql` | `description` + `objective` on walkthroughs. |
| 0007 | `0007_rls.sql` | Row-Level Security policy on every domain table. |
| 0008 | `0008_pbc_entity_scope.sql` | `entity_id` + `template_key` on `pbc_items` for per-entity PBC instantiation. |
| 0009 | `0009_pbc_notes_thread.sql` | `pbc_notes` table (multi-author note thread per PBC item). |

### Domain tables (after all migrations)

- **`engagements`** — one row per audit (or template). `is_template` flips it
  between a live engagement and a firm-wide template.
- **`engagement_memberships`** — `(engagement_id, user_id, role)`.
- **`users`** — Entra users + system role; first sign-in auto-creates the row.
- **`pbc_items`** — PBC list. Columns: `num`, `category`, `item_requested`,
  `why_purpose`, `format_expected`, `priority`, `status`, `owner_client`,
  `date_requested`, `date_received`, `notes`, `tsc_mapping` (jsonb),
  `internal_comments`, `linked_items` (jsonb), `entity_id`, `template_key`.
- **`pbc_notes`** — append-only multi-author thread per PBC item.
- **`access_requests`** — read-only access requests into client systems.
  Columns: `system`, `access_type`, `role_permissions`, `recommended_method`,
  `justification`, `status`, `owner_client`, `provisioned_date`, `notes`.
- **`walkthroughs`** — `process_area`, `description`, `objective`,
  `key_topics`, `attendees`, `proposed_date`, `duration_min`, `status`,
  `notes`.
- **`entities`** — legal entities. `legal_entity`, `country_location`,
  `it_model`, `key_applications`, `hosting`, `headcount`, `in_scope` (Y/N),
  `rationale`.
- **`sampling_items`** — `control_area`, `control_description`,
  `population_source`, `population_size`, `sample_size`, `sampling_method`,
  `test_status`, `findings_summary`.
- **`evidence_files`** — file metadata (filename, size, stored path, MIME,
  uploader) keyed back to a `pbc_items` row. The actual bytes live in Blob
  Storage.
- **`activity_log`** — every field-level change, keyed by
  `(entity_type, entity_id, field)` with old + new values and the user who
  made the change.
- **`saved_views`** — user-defined filter snapshots, scoped by module (`pbc`,
  etc.) — append-only with an `id`.
- **`settings`** — engagement-scoped key/value (client name, period, lead
  auditor, sponsor, project title).

---

## 6. Database access layer (`src/lib/db.ts`)

A thin adapter so the same code runs against pglite (dev) and `pg.Pool` (prod).

- `getDb()` — returns the singleton adapter. Each `query(sql, params)` and
  `withTx(cb)` is parameterised.
- `withEngagement(engagementId, cb)` — opens a transaction, sets
  `app.engagement_id` so RLS lets matching rows through, runs `cb`, commits.
  Every request path uses this.
- `withBypassRls(cb)` — sets `app.bypass_rls = 'on'` for the handful of
  cross-engagement operations (template copy, platform-admin lists). Never
  used on a request that operates on a single engagement.

---

## 7. Modules (the five domain areas)

Each module has the same shape: a `src/lib/repository/<module>.ts` file with
`list*`, `get*`, `update*`, `create*` functions; a row-to-item mapper; and a
`src/app/<module>/<Module>View.tsx` client component plus a route under
`src/app/api/<module>/`.

### 7.1 PBC

- The heart of the app. Each row is one piece of evidence to collect.
- Statuses: `Not Started`, `Requested`, `In Progress`, `Received`, `Reviewed`,
  `N/A`.
- Priorities: `High`, `Medium-High`, `Medium`, `Low-Medium`, `Low`.
- TSC mapping (jsonb array) for SOC 2: `Security`, `Availability`,
  `Confidentiality`, `Processing Integrity`, `Privacy`.
- Each item can be scoped to a specific in-scope entity (`entity_id`), or be
  group-wide (`entity_id = NULL`). A `templateKey` links a row back to a
  library item for `syncPbcEntityScope`, which instantiates per-entity rows
  for every in-scope entity (create-only / idempotent).
- The PBC view supports cards or dense table, filter on every column, built-in
  + user-defined saved views, bulk status / owner / export-selected, undo/redo
  on cell edits, a side detail panel with evidence upload, an activity log
  tab, a notes thread tab, and a linked-items picker.

### 7.2 Walkthroughs

- Working sessions per process area. List view + week calendar with drag-to-
  reschedule. Each row has objective, description, key topics, attendees,
  proposed date, duration, status.

### 7.3 Sampling

- One row per control under test. Captures population source, population
  size, sample size, method, test status, findings. A built-in AICPA-style
  sample-size table (95% confidence, 5% tolerable deviation, 0% expected)
  suggests sample sizes on demand.

### 7.4 Access

- Read-only access provisioning tracker. Each row identifies a target system,
  recommended built-in role, justification, status, owner.

### 7.5 Entities

- The legal entities in scope. Each row has IT model, key applications,
  hosting, headcount, in-scope flag, and rationale. Flipping `in_scope = Y`
  drives per-entity PBC instantiation (see §7.1) and the dashboard scope
  panel.

### 7.6 Admin-added questions and sections (latest)

Every module page has an **+ Add** button visible to `auditor_lead` only. It
opens a small modal whose first field is a **section** combobox: existing
sections appear as suggestions but typing a new name creates a new free-text
section on the fly. Backed by `POST /api/{pbc,walkthroughs,sampling,access}`,
each calling `create*()` in the matching repository — assigns the next
per-engagement `num`, inserts with defaults, logs `created` to the activity
log, and returns the new row. Templates are themselves engagements, so the
same Add UI works inside a template; rows added there flow into new
engagements via `copyTemplateRows`.

---

## 8. Templates

A **template** is an engagement with `is_template = TRUE`. It holds the firm's
standard PBC list, walkthroughs, sampling controls, entity rows, and access
requests. When a new engagement is created with a `fromTemplateId`,
`copyTemplateRows` (`src/lib/repository/engagements.ts`) copies every row from
all five tables into the new engagement, resetting per-client fields (status,
dates, owner, notes, findings) and translating `entity_id` from source to
target.

Per-entity PBC items in the template (e.g. network map per entity) are
instantiated **once per in-scope entity** at seed time via
`syncPbcEntityScope`. The auditor can flip more entities in scope later and
click *Generate per-entity PBC items* on the Entities page to add the missing
instances — idempotent and create-only, never edits or deletes.

A built-in **`src/lib/templates/library.ts`** also encodes the firm's standard
programme in TypeScript, so a fresh install can create useful templates
without uploading the workbook. The same data lives in
`data/templates/IT_Audit_PBC_Tracker_v2.xlsx`, and Settings → *Re-sync from
Excel* will refresh a template engagement from that workbook.

---

## 9. Evidence storage

- File metadata lives in `evidence_files`; bytes live in **Azure Blob Storage**
  (private container, no public access).
- Downloads use short-lived SAS URLs minted on demand — the URL is not
  persisted.
- In production the storage account has versioning + soft-delete; engagement
  retention adds immutability / legal-hold for the retention period.
- Locally, in-process fake-blob storage is used unless Azurite or a real
  account is configured.
- Code: `src/lib/blob.ts`, `src/app/api/evidence/[itemId]/route.ts`,
  `src/app/api/evidence/file/[id]/route.ts`,
  `src/lib/repository/evidence.ts`.

---

## 10. Reports

`@react-pdf/renderer` produces two PDFs server-side:

- **One-pager** — client-facing summary: status mix, priority mix, overdue
  items, top outstanding categories.
- **Full report** — full PBC list grouped by category, with TSC mapping.

Both routes accept an optional TSC filter to narrow to SOC 2 scope. Code:
`src/lib/pdf/templates.tsx`, `src/app/api/reports/[variant]/route.ts`.

---

## 11. Activity log

Every field-level change goes through `logActivity(engagementId, entityType,
entityId, field, oldValue, newValue, userId, tx?)`. The log is queryable
engagement-wide (`/activity`, `/api/timeline`) and per-item (Activity tab in
the detail panel). Auditors see the engagement-wide timeline; clients see only
the per-item log.

Field names use the camelCase domain field names (`status`, `ownerClient`,
`dateRequested`, …) so the timeline is human-readable without translation.

---

## 12. UI map

| Page | Path | Audience | Purpose |
| --- | --- | --- | --- |
| Dashboard | `/` | All | KPI strip, status-by-category bars, priority donut, recent activity, overdue strip, walkthrough lookahead, entity-scope panel |
| PBC List | `/pbc` | All | Cards/table, filters, saved views, bulk actions, detail panel |
| Access | `/access` | All | Access provisioning tracker |
| Walkthroughs | `/walkthroughs` | All | List + week calendar |
| Entities | `/entities` | All | Legal entity scope |
| Sampling | `/sampling` | All | Control test populations + sample-size helper |
| Activity | `/activity` | Auditors | Engagement-wide timeline |
| Reports | `/reports` | Auditors | PDF exports |
| Settings | `/settings` | Auditor lead | Engagement details, Excel re-sync, backups info, users & roles |
| Engagements | `/engagements` | All | Engagement picker |
| New engagement | `/engagements/new` | Platform admin | Create a new engagement (optionally from a template) |
| Members | `/engagements/[slug]/members` | Auditor lead | Per-engagement membership |
| Admin overview | `/admin` | Platform admin | Cross-engagement overview |
| Admin engagements | `/admin/engagements` | Platform admin | All engagements, with counts |
| Admin templates | `/admin/templates` | Platform admin | Engagement templates list |
| New template | `/admin/templates/new` | Platform admin | Create a new template |
| Admin users | `/admin/users` | Platform admin | All users + system role |
| Sign-in | `/signin` | All | NextAuth sign-in screen |

Keyboard shortcuts (PBC list): `?` overlay, `/` focus search, `g d/p/a/w/e/s/t/r/,` jump pages, `j` / `k` cursor, `Enter` open detail, `Esc` close, `⌘ z` / `⇧ ⌘ z` undo/redo.

---

## 13. API surface

All under `src/app/api/`. Method = `auth` (any signed-in user), `role(name)`
(engagement-scoped minimum role), `admin` (platform admin), `health` (open).

| Route | Methods | Min auth | Notes |
| --- | --- | --- | --- |
| `/api/healthz` | GET | open | Healthcheck — returns `{ ok, db, engine, degraded }`. |
| `/api/me` | GET | auth | Current user + role in current engagement. |
| `/api/auth/[...nextauth]` | * | open | NextAuth handlers. |
| `/api/engagements` | GET, POST | auth / admin | List my engagements; create a new one. |
| `/api/engagements/[slug]/switch` | POST, DELETE | auth | Set / clear the active engagement cookie. |
| `/api/engagements/[slug]/members` | GET, POST, DELETE | role(auditor_lead) | Manage members of an engagement. |
| `/api/admin/engagements` | GET | admin | All engagements (with counts). |
| `/api/admin/engagements/[slug]` | DELETE | admin | Hard-delete an engagement (or template) and every row scoped to it. |
| `/api/admin/templates` | GET, POST | admin | List / create templates. |
| `/api/admin/users` | GET, POST | admin | List + create users. |
| `/api/admin/users/[id]` | PATCH | admin | Promote/demote system role. |
| `/api/admin/entra-users` | GET | admin | Search the Entra tenant for users to invite. |
| `/api/dashboard` | GET | role(client_reviewer) | Aggregated dashboard payload. |
| `/api/search` | GET | role(client_reviewer) | Global search across modules. |
| `/api/activity` | GET | role(auditor) | Engagement-wide timeline. |
| `/api/timeline` | GET | role(client_reviewer) | Per-item activity timeline. |
| `/api/pbc` | GET, POST | role(client_reviewer) / role(auditor_lead) | List / create PBC items. |
| `/api/pbc/[id]` | GET, PATCH | role(client_reviewer) / role(client_owner) | Read / partial update. |
| `/api/pbc/[id]/notes` | GET, POST | role(client_reviewer) / role(client_owner) | Read / append to the per-item notes thread. |
| `/api/pbc/[id]/notes/[noteId]` | DELETE | author or role(auditor_lead) | Remove a note. |
| `/api/access` | GET, POST | role(client_reviewer) / role(auditor_lead) | List / create. |
| `/api/access/[id]` | PATCH | role(client_owner) | Update. |
| `/api/walkthroughs` | GET, POST | role(client_reviewer) / role(auditor_lead) | List / create. |
| `/api/walkthroughs/[id]` | PATCH | role(client_owner) | Update. |
| `/api/sampling` | GET, POST | role(client_reviewer) / role(auditor_lead) | List / create. |
| `/api/sampling/[id]` | PATCH | role(client_owner) | Update. |
| `/api/entities` | GET, POST | role(client_reviewer) / role(auditor) | List / create blank row. |
| `/api/entities/[id]` | PATCH, DELETE | role(auditor) | Update / delete (PBC items scoped to it become group-wide). |
| `/api/entities/sync-pbc` | POST | role(auditor) | Idempotently create per-entity PBC rows for every in-scope entity. |
| `/api/evidence/[itemId]` | GET, POST | role(client_reviewer) / role(client_owner) | List or upload evidence for a PBC item. |
| `/api/evidence/file/[id]` | GET, DELETE | role(client_reviewer) / uploader or role(auditor_lead) | Download (SAS URL) / delete. |
| `/api/saved-views` | GET, POST | auth | List / create user-defined saved views. |
| `/api/saved-views/[id]` | DELETE | auth | Delete a saved view. |
| `/api/settings` | GET, PUT | role(client_reviewer) / role(auditor_lead) | Engagement-wide settings. |
| `/api/users` | GET | role(client_reviewer) | Users visible in the current engagement. |
| `/api/users/[id]` | PATCH | role(auditor_lead) | Update engagement-scoped role. |
| `/api/import` | POST | role(auditor_lead) | Re-sync the engagement from an Excel workbook. |
| `/api/export` | GET | role(client_reviewer) | Export PBC list to Excel. |
| `/api/reports/[variant]` | GET | role(auditor) | Generate a PDF (one-pager / full). |

---

## 14. Code layout

```
src/
├── app/                       Next.js App Router pages + API
│   ├── (pages)/               UI per module (PBCView, WalkthroughsView, …)
│   └── api/                   Route handlers (38 files)
├── components/
│   ├── ui/                    Buttons, badges, AddItemDialog, HelpStrip, …
│   ├── tables/                Inline editors (InlineText/Select/Date), save indicators
│   ├── shell/                 App shell (nav, entity filter, search overlay)
│   ├── dashboard/             Dashboard chart components
│   └── pbc/                   PBC-specific subcomponents
├── lib/
│   ├── auth.ts, auth.config.ts, rbac.ts
│   ├── db.ts                  pglite/pg adapter + withEngagement / withBypassRls
│   ├── migrations/            Numbered .sql + runner.ts
│   ├── repository/            One file per domain table
│   ├── templates/library.ts   In-code firm template programme
│   ├── excel/                 SheetJS import + run-import script
│   ├── pdf/templates.tsx      @react-pdf templates
│   ├── blob.ts                Blob storage abstraction
│   ├── graph.ts               Microsoft Graph (Entra) calls for B2B invite search
│   └── forms/useDirtyForm.ts
├── types/index.ts             Shared TypeScript types (PBCItem, etc.)
└── middleware.ts              Edge middleware (NextAuth + cookie checks)
```

---

## 15. Infrastructure (Azure)

Defined in `infra/` as Bicep. One Resource Group per engagement:
**`rg-audit-<client>-<env>`**.

Resources inside the RG:

- **Azure App Service** (Linux, container) — runs the Next.js app. Pulls
  images from GitHub Container Registry via the registered Managed Identity.
- **App Service Plan** — chosen via `appPlanSku` parameter (`B1`/`B2`/
  `S1`/`S2`/`S3`/`P0v3`/`P1v3`).
- **Azure Database for PostgreSQL Flexible Server** — Entra-auth only; no
  passwords. Sized via `postgresSku` (`Standard_B1ms` / `Standard_B2s` /
  `Standard_D2ds_v5`) and `postgresStorageGB` (32/64/128/256). Backups: daily
  + 7-day point-in-time restore by default; geo-redundant.
- **Azure Storage Account** — single private blob container for evidence.
  Versioning + soft-delete enabled; immutability/legal-hold for retention.
- **Key Vault** — holds the NextAuth signing secret. Resolved by the App
  Service via a Key Vault reference in app settings.
- **Application Insights** + **Log Analytics workspace** — runtime telemetry.

Outputs (from `main.bicep`) include the App Service hostname and the App
Service Managed Identity object ID — used in the post-deploy step to grant
the identity database access.

Per-engagement cost: roughly **~$50/mo** baseline; **~$95/mo** if Front Door +
WAF + private endpoints are enabled (these are documented in the runbook but
default to off in `workload.bicep`).

### Identity & authentication wiring

- **App Service Managed Identity** is granted the database role
  (`pgaadauth_create_principal_with_oid` + table grants) so the app
  authenticates to Postgres with no password.
- The same Managed Identity has `Storage Blob Data Contributor` on the
  evidence container.
- **GitHub Federated Identity** lets GitHub Actions log in to Azure with no
  stored credential. The subject claims pinned are
  `repo:<owner>/<repo>:ref:refs/heads/main` and
  `repo:<owner>/<repo>:environment:production`.

### Required GitHub secrets / variables

- Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`.
- Variables (per engagement): `AZURE_WEBAPP_NAME`, `AZURE_RESOURCE_GROUP`,
  `GHCR_OWNER`.

(Values are intentionally not listed here.)

---

## 16. CI/CD

Two GitHub Actions workflows:

- **`.github/workflows/ci.yml`** — runs on every pull request and on pushes to
  `main`. Boots an ephemeral Postgres, provisions a non-superuser app role,
  runs migrations as that role (mirrors prod), runs the RLS isolation
  assertions, runs the typecheck + Next build. Uses `actions/setup-node@v5`
  (Node 24) with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` to keep third-party
  actions on Node 24 ahead of the 2026-06-02 forced migration.
- **`.github/workflows/deploy.yml`** — `workflow_dispatch` only. Builds the
  container, pushes to ghcr.io, points the App Service at the new tag,
  restarts, and smoke-tests `/api/healthz`. Login uses OIDC Federated
  Identity.

Concurrency in CI is grouped by ref with `cancel-in-progress: true` so a new
push supersedes a running build.

---

## 17. Local development

```bash
npm install
cp .env.example .env.local         # set AUTH_DEV_BYPASS=1 to test the role system
npm run migrate                     # apply pglite schema once
npm run dev                         # http://localhost:3000
```

Useful scripts (`package.json`):

| Script | Purpose |
| --- | --- |
| `dev` | Next dev server. |
| `build` | Next production build. |
| `start` | Start the production server (after `build`). |
| `lint` | `next lint`. |
| `migrate` | Apply `src/lib/migrations/*.sql` against the configured DB. |
| `import` | Run the Excel importer against `data/templates/…`. |
| `check:library` | Assert `src/lib/templates/library.ts` matches the canonical workbook. |
| `test:rls` | Run the RLS isolation assertions. |
| `test:e2e` | Run Playwright tests (Chromium). |
| `test:e2e:install` | Install Playwright Chromium with system deps. |

Data lives at `data/pgdata/` (pglite, gitignored). In Azure, nothing is on
disk — Postgres is managed, evidence is in Blob.

---

## 18. Operations

- **Backups** — Postgres: managed by Azure (daily PITR, geo-redundant).
  Evidence: blob versioning + soft-delete + optional immutability. The
  Settings → Backups page surfaces this for the audit lead.
- **Restore** — Azure portal → the RG → Postgres server → Restore. Evidence
  versions are restored from the storage account.
- **Engagement end** — produce the final export bundle (Excel + PDFs +
  evidence ZIP), then either stop the App Service + Postgres to preserve data
  for retention, or delete the entire RG.
- **Smoke** — `infra/PROD-SMOKE.md` is the post-deploy checklist with the
  exact curl/SQL commands and expected outputs.
- **Activity log retention** — currently un-purged; a future migration would
  evict log rows past the retention policy.

---

## 19. Known rough edges (tracked, not blockers)

- Engagement start date / "Access by week 1" flag not yet wired.
- Front Door + WAF + private endpoints documented in the runbook but not
  enabled by default in `workload.bicep`.
- Linked-items picker (PBC) could be polished.
- Daily activity-log retention not auto-purged.

---

## 20. Quick links to the source

- DB adapter: `src/lib/db.ts`
- Migrations: `src/lib/migrations/`
- RBAC: `src/lib/rbac.ts`
- Auth: `src/lib/auth.ts`, `src/lib/auth.config.ts`, `src/middleware.ts`
- Repositories: `src/lib/repository/`
- PDF templates: `src/lib/pdf/templates.tsx`
- Template library: `src/lib/templates/library.ts`
- Infra: `infra/main.bicep`, `infra/workload.bicep`, `infra/deploy.sh`,
  `infra/RUNBOOK.md`, `infra/PROD-SMOKE.md`
- CI/CD: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`
