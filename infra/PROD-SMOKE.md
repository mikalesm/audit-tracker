# Production smoke checklist

Walk this after every fresh deploy or after any infra change. Each step has an
exact expected output — if reality differs, that's the failure to investigate.

The checklist assumes the engagement is `audit1` in `prod` (RG
`rg-audit-audit1-prod`); substitute your slug.

## 0. Variables for copy-paste

```bash
CLIENT=audit1
ENV=prod
RG=rg-audit-${CLIENT}-${ENV}
APP=app-audit-${CLIENT}-${ENV}
PG=psql-audit-${CLIENT}-${ENV}
HOST=$(az webapp show -g $RG -n $APP --query defaultHostName -o tsv)
echo "https://$HOST"
```

## 1. Healthz reports real Postgres

```bash
curl -fsS "https://$HOST/api/healthz" | jq .
```

Expected:

```json
{ "ok": true, "db": "up", "engine": "postgres", "degraded": false, "ts": "…" }
```

❌ If `engine` is `"pglite"`: the App Service env vars are missing, or the
Managed Identity has no Postgres grant. Container falls back to in-memory
storage → data evaporates on restart. **Stop and fix before continuing.**

## 2. Lead auditor signs in and becomes `auditor_lead`

1. Open `https://$HOST/` in an Incognito window.
2. Sign in with the work account whose email is in
   `AUDITOR_LEAD_BOOTSTRAP_EMAILS` (see Bicep param).
3. Land on `/` (Dashboard).
4. `curl -fsS "https://$HOST/api/me" --cookie <copied session cookie>` should
   show `role: "auditor_lead"`.

❌ If the role is `client_reviewer`: the bootstrap email list doesn't match.
Update the Bicep param and redeploy, or `setUserRole` via Settings → Users.

## 3. Excel import populates real Postgres

1. Settings → Re-sync from Excel → upload `IT_Audit_PBC_Tracker_v2.xlsx`.
2. Dashboard now shows 55 PBC items, scope panel shows entities.
3. Cross-check directly in Postgres:

```bash
TOKEN=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
ME=$(az ad signed-in-user show --query userPrincipalName -o tsv)
PGHOST=$(az postgres flexible-server show -g $RG -n $PG --query fullyQualifiedDomainName -o tsv)
PGPASSWORD="$TOKEN" psql "host=$PGHOST port=5432 dbname=audit user=$ME sslmode=require" -c "SELECT COUNT(*) FROM pbc_items;"
```

Expected: `55`.

❌ If the count is `0` after a "successful" import: app is hitting pglite
(see Step 1) rather than Postgres. Container fix needed.

## 4. Evidence upload lands in Blob Storage

1. Open any PBC item → Evidence tab → upload a small PDF.
2. List the storage container:

```bash
STG=$(az storage account list -g $RG --query "[0].name" -o tsv)
az storage blob list --account-name $STG -c evidence --auth-mode login -o table
```

Expected: at least one blob with a name that includes the PBC item id.

3. Click "Download" in the app → file opens (proves SAS URL minting works).

❌ If listing the container is denied: the App Service identity is missing
`Storage Blob Data Contributor` on `$STG`. Re-run the role assignment from
`infra/deploy.sh`.

## 5. B2B guest sign-in flow

1. Entra portal → Users → "+ Invite external user" → use your personal-tenant
   address (gmail/outlook/another corp tenant). Send the invite.
2. Open the invite link in a private window, accept, complete MFA setup.
3. Land on `https://$HOST/signin` and sign in.
4. `curl -fsS "https://$HOST/api/me" --cookie …` reports
   `role: "client_reviewer"`. Email should display as your home-tenant address,
   **not** the `#EXT#` form.
5. Try to load `/activity` → redirects or 403.
6. Sign in as lead in another window → Settings → Users & roles → promote the
   guest to `client_owner`. Refresh the guest's session → `/api/me` reports the
   new role; `/activity` still 403 (correct — only auditors see the timeline).

❌ If sign-in fails outright: check that the Entra App Registration's
sign-in audience is `AzureADMyOrg` *not* `PersonalMicrosoftAccount` — guests
of your tenant are AzureADMyOrg by design.

## 6. PDF reports

```bash
curl -sS "https://$HOST/api/reports/client" --cookie … -o /tmp/client.pdf
curl -sS "https://$HOST/api/reports/full"   --cookie … -o /tmp/full.pdf
file /tmp/client.pdf /tmp/full.pdf
```

Both should report `PDF document`.

## 7. Data survives restart

```bash
az webapp restart -g $RG -n $APP
sleep 60
curl -fsS "https://$HOST/api/healthz" | jq .engine        # still "postgres"
# Open the app → Dashboard still shows 55 items
```

❌ If counts drop to 0: pglite regression (Step 1 failed silently). Same fix.

## 8. App Insights

Open `appi-audit-${CLIENT}-${ENV}` → "Live metrics" while you click through
the app. Expect:
- Request rate visible
- No exception spikes
- Server response times under 1 s for `/api/*`

## 9. Keyboard shortcuts and visual polish (manual)

Press `?` on Dashboard → overlay appears. Use `g d`, `g p`, etc., to navigate.
Try inline-editing a PBC item's status; activity log entry appears immediately.

## Rollback if something is broken

```bash
# Tail logs
az webapp log tail -g $RG -n $APP

# Roll back to previous image (replace TAG with prior short-sha)
az webapp config container set -g $RG -n $APP \
  --container-image-name ghcr.io/<owner>/audit-tracker:<TAG>
```

A clean redeploy after a code fix:

```bash
gh workflow run deploy.yml -f tag=$(git rev-parse --short HEAD)
gh run watch
```
