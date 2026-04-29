# IT Audit — PBC Tracker 📋

A secure shared workspace for an IT audit engagement: general IT controls, SOC 2 readiness, software licensing, IT spend. The same UI is used by the lead auditor and the auditee — think of it as a **dataroom-grade single sheet** where the client uploads evidence and both sides watch progress in real time.

| | |
| --- | --- |
| **Identity** | Microsoft Entra ID (B2B Guest invites for client users; auditors use their work account; MFA via Conditional Access) |
| **Database** | Azure Database for PostgreSQL Flexible Server (Entra auth via Managed Identity, no passwords) |
| **Evidence storage** | Azure Blob Storage (private container, short-lived SAS URLs for downloads) |
| **Compute** | Azure App Service (Linux container) |
| **Image registry** | GitHub Container Registry (`ghcr.io`) |
| **CI/CD** | GitHub Actions, OIDC federated identity to Azure (no stored credentials) |
| **Tenancy** | One Azure Resource Group per engagement (clean spin-up, clean spin-down) |

---

## Quick start (local development)

You don't need Docker, Postgres, or Azure to develop locally — the app runs against [`@electric-sql/pglite`](https://github.com/electric-sql/pglite) (an embedded WASM Postgres) and stores blobs in memory unless you point it at Azurite.

```bash
npm install
cp .env.example .env.local
# Either leave it as-is to run open / unauthenticated, or set AUTH_DEV_BYPASS=1 to
# require sign-in with a fake user (the first user becomes auditor_lead).
npm run migrate    # apply pglite schema once
npm run dev        # http://localhost:3000
```

Then go to **Settings → Re-sync from Excel** and upload `IT_Audit_PBC_Tracker_v2.xlsx` (or any equivalent workbook). 55 PBC items, 19 access requests, 11 walkthroughs, 14 entity rows, 16 sampling controls.

### Auth modes

| `AZURE_AD_CLIENT_ID` | `AUTH_DEV_BYPASS` | Behavior |
| --- | --- | --- |
| set | unset | Production: real Microsoft Entra sign-in |
| unset | `1` | Local dev with a fake credentials form (any email = a fake user) |
| unset | unset | Open mode — no sign-in, no role checks (useful for smoke tests only) |

### Where data lives

```
audit-tracker/
├── data/pgdata/        # pglite database (gitignored)
├── data/evidence/      # ↓ on Azure: Blob Storage; locally: not used (fake-blob path)
├── src/lib/migrations/ # numbered .sql files; apply with `npm run migrate`
└── ...
```

In Azure, **nothing is on disk** — Postgres lives in Azure Database for PostgreSQL, evidence in Blob Storage. Per-engagement backups are managed by Azure (PITR + geo-redundant for Postgres; versioning + soft-delete for blobs).

---

## Deploying to Azure

See [**`infra/RUNBOOK.md`**](infra/RUNBOOK.md) for the full per-engagement deployment runbook. The short version:

```bash
# 1. one-time per tenant: create the Entra App Registration + GitHub Federated Identity
# 2. per engagement:
cp infra/parameters.acme.json infra/parameters.<client>.json
# … edit clientSlug, postgresEntraAdminObjectId, azureAdClientId, etc.
./infra/deploy.sh <client> prod
# 3. trigger GitHub Actions → Deploy → "Run workflow"
# 4. open https://app-audit-<client>-prod.azurewebsites.net/
# 5. sign in (auditor lead first), upload the PBC tracker Excel via Settings
# 6. invite client users as B2B Guests in Entra; promote them to client_owner in Settings → Users & roles
```

Per-engagement cost: **~$50/mo** baseline, **~$95/mo** with Front Door + WAF.

---

## What's where (UI)

| Page | Path | Audience | Purpose |
| --- | --- | --- | --- |
| Dashboard | `/` | All | KPI strip, status-by-category bars, priority donut, recent activity, overdue strip, walkthrough lookahead, entity scope panel |
| PBC List | `/pbc` | All | Dense table of all items. Inline edit on Status / Owner / Dates / Notes / Priority / TSC. Filters on every column. Built-in + user-defined saved views. Bulk status / owner / export-selected. Side panel with evidence upload, activity log, linked-item picker, internal comments |
| Access | `/access` | All | Read-only access provisioning tracker |
| Walkthroughs | `/walkthroughs` | All | List view + week-calendar with drag-and-drop reschedule. Click a card for full topics + attendees |
| Entities | `/entities` | All | Add / edit / remove legal entities; In-Scope toggle drives dashboard scope panel |
| Sampling | `/sampling` | All | Control test populations + sample-size suggester (95% confidence / 5% tolerable) |
| Activity | `/activity` | Auditors | Engagement-wide timeline, every change attributed to a user |
| Reports | `/reports` | Auditors | One-page client PDF + full PDF, with optional SOC 2 TSC filter |
| Settings | `/settings` | Auditor lead | Engagement details, Excel import, Backups info, Users & roles, Theme |

### Roles

| Role | Can |
| --- | --- |
| `auditor_lead` | Everything. Promote/demote users, re-import Excel, delete evidence. |
| `auditor` | Read everything. Edit PBC / access / walkthroughs / entities / sampling. View engagement timeline. Generate reports. |
| `client_owner` | Read everything except internal comments + the engagement timeline. Edit Status / Owner / Dates / Notes on items they're assigned to. Upload evidence. |
| `client_reviewer` | Read everything except internal comments + the engagement timeline. Cannot edit. |

The first user to sign in is auto-promoted to `auditor_lead` so a fresh deployment is never bricked with no admin.

---

## Keyboard shortcuts

Press `?` anywhere to bring up the overlay.

| Key | Action |
| --- | --- |
| `/` | Focus the global search |
| `g d` | Dashboard |
| `g p` | PBC List |
| `g a` | Access |
| `g w` | Walkthroughs |
| `g e` | Entities |
| `g s` | Sampling |
| `g t` | Activity timeline |
| `g r` | Reports |
| `g ,` | Settings |
| `j` / `k` | Move row cursor down / up (PBC) |
| `Enter` | Open detail panel |
| `Esc` | Close detail panel / overlays |
| `⌘ z` / `⇧ ⌘ z` | Undo / redo last cell edit (last 20 PBC edits) |

---

## Tech notes

- **Next.js 14 (App Router)** + **TypeScript** + **Tailwind**
- **NextAuth v5** with the Microsoft Entra ID provider; split config (`auth.config.ts` is Edge-safe for middleware; `auth.ts` is the full Node config)
- **`pg` + a thin `DbAdapter`** that swaps between pglite (dev) and a real `pg.Pool` (Azure) — every repository is async and parameterized
- **`@azure/storage-blob`** + **`@azure/identity`** — Managed Identity in Azure, well-known emulator string locally
- **`@react-pdf/renderer`** for the two PDF reports — server-side rendering, Helvetica, single accent color
- **Recharts** for the dashboard charts
- **Bicep** for infra; one `main.bicep` + `parameters.<client>.json` per engagement

PDF templates: [src/lib/pdf/templates.tsx](src/lib/pdf/templates.tsx). DB adapter: [src/lib/db.ts](src/lib/db.ts). Migrations: [src/lib/migrations/](src/lib/migrations/). Auth: [src/lib/auth.ts](src/lib/auth.ts), [src/lib/auth.config.ts](src/lib/auth.config.ts), [src/middleware.ts](src/middleware.ts). RBAC: [src/lib/rbac.ts](src/lib/rbac.ts).

---

## Backup, restore, retention

All managed by Azure:

- **Postgres** — daily automated backup with 7-day point-in-time restore by default; geo-redundant. To restore: Azure portal → your RG → the Postgres server → Restore.
- **Evidence blobs** — versioning + soft-delete enabled; in production the container has immutability/legal-hold for the engagement retention period.
- **Engagement end** — final export bundle (PDFs + Excel + evidence ZIP), then either stop the App Service + Postgres to save cost (preserves data for retention) or delete the RG entirely.

---

## Known rough edges

- **Engagement start date / "Access by week 1" flag** — the Access view counts "Not Requested" but doesn't yet flag items past the engagement start. Easy add (one Settings field).
- **Front Door + WAF + private endpoints** are documented in the runbook but not yet enabled by default in `workload.bicep` (the `publicNetworkAccess` flag stays `Enabled` until you tighten it).
- **Linked items API exists; the UI to *create* a link is wired but the picker can be polished.**
- **Daily activity-log retention** isn't auto-purged; if your retention policy says e.g. "evict access_log rows older than 18 months," that's a future migration.
