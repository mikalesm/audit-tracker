# Per-engagement Azure deployment runbook

This runbook spins up one **Resource Group per engagement**. The first deploy takes ~10 minutes; subsequent deploys (new app version) are ~2 minutes via the GitHub Actions `deploy.yml` workflow.

## 0. One-time, your-tenant setup (do this once, not per engagement)

1. **Install tooling** locally (or use Azure Cloud Shell): Azure CLI ≥ 2.55, GitHub CLI, Docker (only needed if you want to test container builds locally — CI builds them otherwise).
2. **Create a security group** in Entra (e.g. `audit-leads`) for the people who should administer the database. Note its Object ID (`az ad group show --group audit-leads --query id -o tsv`).
3. **Create the Microsoft Entra App Registration** for the app (one per engagement is cleanest, but you can reuse one across engagements):
   ```bash
   az ad app create --display-name "Audit Tracker — Acme" \
     --sign-in-audience AzureADMyOrg \
     --web-redirect-uris "https://app-audit-acme-prod.azurewebsites.net/api/auth/callback/microsoft-entra-id"
   ```
   Note the `appId` (= `AZURE_AD_CLIENT_ID`).
4. **Federated identity for GitHub Actions** (no client secret on GitHub):
   ```bash
   APP_OBJECT_ID=$(az ad app show --id <AZURE_AD_CLIENT_ID> --query id -o tsv)
   az ad app federated-credential create --id "$APP_OBJECT_ID" --parameters '{
     "name": "github-deploy-main",
     "issuer": "https://token.actions.githubusercontent.com",
     "subject": "repo:<owner>/audit-tracker:ref:refs/heads/main",
     "audiences": ["api://AzureADTokenExchange"]
   }'
   ```
   Repeat with subject `repo:<owner>/audit-tracker:environment:production` for the `deploy.yml` workflow's `production` environment.
5. **Configure GitHub repo secrets/variables** (Settings → Secrets and variables → Actions):
   - Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`
   - Variables: `AZURE_WEBAPP_NAME` (e.g. `app-audit-acme-prod`), `AZURE_RESOURCE_GROUP` (e.g. `rg-audit-acme-prod`), `GHCR_OWNER` (your GitHub user/org)

## 1. Per-engagement deploy

1. **Bootstrap secrets**: generate a NEXTAUTH secret and store it in your home Key Vault:
   ```bash
   openssl rand -base64 32 > /tmp/nextauth.txt
   az keyvault secret set --vault-name <your-bootstrap-kv> --name audit-tracker-nextauth-secret --file /tmp/nextauth.txt
   shred -u /tmp/nextauth.txt   # macOS: rm /tmp/nextauth.txt
   ```
2. **Copy and edit** `infra/parameters.acme.json` to `infra/parameters.<client>.json`:
   - `clientSlug`: lowercase short name
   - `postgresEntraAdminObjectId`: object ID of the `audit-leads` group
   - `postgresEntraAdminLogin`: a friendly login string (UPN or group display name)
   - `azureAdClientId`, `azureAdTenantId`: from step 0.3
   - `engagementName`: e.g. `"Acme FY26 IT Audit"`
   - `nextAuthSecret`: leave the keyVault reference, edit the subscription/RG/vault to point at your bootstrap KV
3. **Deploy infra**:
   ```bash
   az login
   az account set --subscription <sub-id>
   ./infra/deploy.sh <client> prod
   ```
   This creates `rg-audit-<client>-prod` and everything inside.
4. **Grant Postgres access to the App Service Managed Identity**:
   ```bash
   APP_PRINCIPAL=$(az deployment sub show --name <last-deploy-name> --query 'properties.outputs.appPrincipalId.value' -o tsv)
   PG_NAME=$(az postgres flexible-server list -g rg-audit-<client>-prod --query "[0].name" -o tsv)
   APP_NAME=$(az webapp list -g rg-audit-<client>-prod --query "[0].name" -o tsv)
   az postgres flexible-server ad-admin create -g rg-audit-<client>-prod -s "$PG_NAME" \
     --display-name "$APP_NAME" --object-id "$APP_PRINCIPAL" --type ServicePrincipal
   ```
   Then connect to the database as your engagement-lead group (which IS the Entra admin) and grant the App Service identity:
   ```sql
   -- run as the Entra admin
   SELECT * FROM pgaadauth_create_principal_with_oid('<APP_NAME>', '<APP_PRINCIPAL>', 'service', false, false);
   GRANT CONNECT ON DATABASE audit TO "<APP_NAME>";
   GRANT USAGE ON SCHEMA public TO "<APP_NAME>";
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "<APP_NAME>";
   GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "<APP_NAME>";
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "<APP_NAME>";
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE ON SEQUENCES TO "<APP_NAME>";
   ```
5. **Trigger the GitHub Actions deploy** from the repo (Actions → Deploy → Run workflow on `main`). The workflow builds the container, pushes it to ghcr.io, points the App Service at it, and waits for `/api/healthz`.
6. **First sign-in**: visit `https://app-audit-<client>-prod.azurewebsites.net/`. Sign in with your work account (already a member of the `audit-leads` group). The first user becomes `auditor_lead` automatically.
7. **Apply migrations**: `Settings → Backups` shows that backups are managed by Azure. Migrations run automatically on app start. To force-apply manually:
   ```bash
   az webapp ssh -g rg-audit-<client>-prod -n <APP_NAME> --command "cd /app && node_modules/.bin/tsx scripts/migrate.ts"
   ```
8. **Seed data**: in the app, go to Settings → Re-sync from Excel → upload `IT_Audit_PBC_Tracker_v2.xlsx`. Verify 55 PBC items appear on the dashboard.

## 2. Onboard the client

1. **Invite as B2B Guest** in Entra: Identity → Users → Invite external user → enter their email + display name. They get an invite email.
2. They click → set up MFA in their tenant → land on the app's `/signin` page → sign in.
3. You (auditor lead) go to **Settings → Users & roles** and promote them to `client_owner`.
4. Send them the URL and a short walkthrough.

## 3. Hardening (do before going live)

- [ ] **Front Door + WAF Premium** in front of the App Service; restrict App Service ingress to Front Door (Service Tag `AzureFrontDoor.Backend` + `X-Azure-FDID` header check).
- [ ] **Private endpoints** for Postgres + Storage; set `publicNetworkAccess: Disabled` on both.
- [ ] **Conditional Access** policy: require MFA for users accessing this App Registration.
- [ ] **Storage immutability** (legal hold) on the `evidence` container for the engagement-end retention period.
- [ ] **App Insights alerts**: 5xx rate, sign-in failures, evidence upload failures, Defender malware-detected events.
- [ ] **Defender for Cloud** enabled at the subscription level (CSPM tier minimum).
- [ ] **Quarterly Entra Access Reviews** auto-revoke stale guest accounts.

## 4. Engagement-end runbook

When the audit closes:

1. Final export bundle from the app (`Reports → Full PDF`, `Excel export`, evidence ZIP via Azure Storage Explorer or `az storage blob download-batch`).
2. Hand the bundle to the client + your firm's archive.
3. Apply legal hold + retention policy on the `evidence` container.
4. **Spin down compute** to save cost (preserves data for the retention period):
   ```bash
   az webapp stop          -g rg-audit-<client>-prod -n <APP_NAME>
   az postgres flexible-server stop -g rg-audit-<client>-prod -n <PG_NAME>
   ```
5. **Or**, after the retention period, delete the entire RG:
   ```bash
   az group delete -n rg-audit-<client>-prod
   ```

## 5. Cost reference

| Resource             | SKU              | $/mo     |
|----------------------|------------------|----------|
| App Service Plan     | B2 Linux         | ~$25     |
| Postgres Flexible    | B1ms, 32 GB      | ~$20     |
| Storage Account      | Standard LRS     | ~$3      |
| Key Vault            | Standard         | ~$1      |
| Application Insights | first 5 GB free  | ~$0–10   |
| Log Analytics        | per-GB           | ~$2      |
| Entra B2B Guest      | up to 50 K MAU   | $0       |
| Front Door + WAF P   | optional         | ~$35     |
| **Total**            |                  | **~$50 (basic) / ~$95 (with WAF)** |
