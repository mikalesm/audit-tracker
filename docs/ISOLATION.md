# Engagement isolation — what stops audit X from seeing audit Y

This is the engagement-isolation contract for the multi-tenant master. It's
the document to reach for when a client or auditor asks **"how do you keep
my evidence separate from other clients?"**

## TL;DR

For every engagement on the platform:

- A unique row in `engagements`, identified by `engagement_id` (BIGSERIAL,
  never reused).
- Every domain table (`pbc_items`, `access_requests`, `walkthroughs`,
  `entities`, `sampling_items`, `evidence_files`, `settings`, `saved_views`,
  `activity_log`, `access_log`) carries the engagement's `engagement_id` as
  a NOT NULL foreign key and is filtered by it on every SELECT/UPDATE/
  INSERT/DELETE.
- A dedicated Azure Blob Storage container named `evidence-eng-<id>`,
  pre-created when the engagement is created. Cross-container writes are
  impossible from the application code path because `containerNameFor` is
  the only function that constructs the name and it derives the suffix
  directly from the engagement ID resolved from the actor's session.
- An explicit membership row in `engagement_memberships`. **Cookie alone
  never grants data access.** Every API request re-validates the actor's
  membership against the DB before returning anything. `platform_admin`
  is no exception — see the switch endpoint.

## Layer-by-layer

### Identity layer

- `engagements.id` is a `BIGSERIAL` primary key. Postgres never reuses
  sequence values, so deleting an engagement and creating another does not
  resurrect the old ID.
- `engagement_memberships(engagement_id, user_id, role)` is the only source
  of truth for "can this user see this engagement?"

### Request layer (`src/lib/rbac.ts`)

Every request flows through `getActor()`:

1. Read the NextAuth session → `userId`.
2. Read the `audit_engagement` cookie → engagement slug.
3. Look up the engagement by slug → if missing, `engagement = null`.
4. Look up `engagement_memberships(engagement.id, userId)` → if missing,
   `role = null`.
5. Return `{ userId, email, systemRole, engagement, role }` — note that
   `engagement` is null *unless* the user is actually a member.

`requireRole(min)` then enforces:

- 401 if no session
- 400 if no engagement selected
- 403 if `role` is below `min`

The cookie carries the slug only — it doesn't grant anything. A user could
forge or copy a cookie containing another engagement's slug; on the next
request `getMembership()` returns null and the request 400s. **No data
leaks through cookie tampering.**

### Switch endpoint (`POST /api/engagements/[slug]/switch`)

To set the engagement cookie, the user must first be an *explicit member*
of the engagement. Platform admins are not exempt — they must use the
admin pages to add themselves as `auditor_lead` first. This means a
platform admin who is not a member of audit X can see that audit X exists
in the admin tables but cannot view its data without taking an explicit
action that is logged in `engagement_memberships.added_at`.

### Database layer

Every domain table carries `engagement_id BIGINT NOT NULL REFERENCES
engagements(id)`. Every query in `src/lib/repository/*.ts` takes
`engagementId` as its first argument and filters on it. The composite
uniqueness on `(engagement_id, num)` for PBC / access / walkthroughs /
entities / sampling lets two engagements both have a "#1" without
collision.

A migration (`0005_rls.sql`, *not yet enabled*) is planned that turns on
Postgres Row-Level Security as a belt-and-braces defense — every query
inside a request would `SET LOCAL app.engagement_id = N` and RLS policies
would block reads that don't match. Until then the application-level
filtering is the enforcement.

### Storage layer (`src/lib/blob.ts`)

Each engagement gets its own Blob Storage container:

- Container name: `evidence-eng-<id>` (immutable for the life of the
  engagement).
- `containerNameFor(engagementId)` rejects non-positive / non-integer IDs.
- `evidenceContainerFor(engagementId)` creates the container if missing
  and caches the client.
- Blob path inside the container: `eng-<id>/<itemId>/<ts>-<filename>` —
  the engagement ID is *also* in the path, so even if a future bug pointed
  to the wrong container the blob name would tell you what it was meant
  for.
- SAS URLs are minted per-blob, scoped to that one blob's read permission,
  with a 30-second TTL by default.

**What stops a client_owner of audit X from reading audit Y's evidence?**

1. They have no membership in audit Y. Their `getActor()` would return
   `engagement.id = X`. `listEvidence(X, itemId)` only ever returns rows
   with `engagement_id = X`. The download endpoint
   `GET /api/evidence/file/[id]` filters on `engagement_id = actor.engagement.id`
   and returns 404 for any blob that belongs to another engagement.
2. Even if they directly knew a blob's name and tried to call
   `downloadSasUrl(X, "eng-Y/...")`, the SAS would be minted for
   container `evidence-eng-X`, not `evidence-eng-Y`. Azure rejects the
   download because the blob doesn't exist in the named container.
3. Even if they tampered with the cookie to set engagement to Y, step 1's
   membership check denies the request before any blob path is
   constructed.

### What this does *not* protect against

- A misconfigured Azure Storage Account that grants `Storage Blob Data
  Reader` to everyone in your tenant. Verify in the Azure portal that the
  storage account has `Allow Storage Account Key Access = Disabled`,
  network restrictions, and that no rogue role assignment was added.
- A compromised App Service Managed Identity. The MI has
  `Storage Blob Data Contributor` on the account, so anyone who can run
  code in your container could in theory read any container. Treat the
  container as a hostile-environment artifact (do not place secrets in
  blobs, encrypt sensitive content client-side if appropriate).
- A compromised platform admin. They can promote themselves into any
  engagement via `/admin/engagements → Join as lead`. That action is
  logged (`engagement_memberships.added_at`) but not blocked. If you need
  god-mode protection from your own admin, add a four-eyes review process
  outside the app.

## Verifying isolation in production

```bash
# Run from Azure Cloud Shell after signing in
RG=rg-audit-<client>-prod
APP=app-audit-<client>-prod
STG=$(az storage account list -g $RG --query "[0].name" -o tsv)

# 1. Each engagement maps 1:1 to its own container
az storage container list --account-name $STG --auth-mode login \
  --query "[?starts_with(name, 'evidence-eng-')].{container:name}" -o table

# 2. Cross-check against the engagements table
PGHOST=$(az postgres flexible-server list -g $RG --query "[0].fullyQualifiedDomainName" -o tsv)
TOKEN=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
ME=$(az ad signed-in-user show --query userPrincipalName -o tsv)
PGPASSWORD="$TOKEN" psql "host=$PGHOST port=5432 dbname=audit user=$ME sslmode=require" \
  -c "SELECT 'evidence-eng-' || id AS expected_container, slug, name FROM engagements ORDER BY id;"

# Compare the two listings — they should match 1:1.
```
