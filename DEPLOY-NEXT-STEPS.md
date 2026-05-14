# Deploy: what's done vs. what you do next

This is the literal sequence to take the local repo → live Azure deployment for one client engagement. Every command is copy-paste-ready; placeholders look like `<this>`.

---

## ✅ Already done for you

- Local toolchain installed: **Node 20.20.2** at `~/.local/node-v20/`, **GitHub CLI 2.92.0** at `~/.local/gh-cli/`. Both are on your `PATH` via `~/.zshrc`.
- Repo initialized as a git repo at `/Users/mihaicotocel/Desktop/piper/audit-tracker` with two commits.
- A `NEXTAUTH_SECRET` (32-byte random base64) generated and saved to `.env.production.local` — gitignored. **Treat this file like a password.** You'll paste its value into Azure Key Vault in step 4.
- All code: Postgres migration, NextAuth + Entra, Blob storage, Dockerfile, GitHub Actions, Bicep templates, runbook.
- Local dev server can run any time: `cd /Users/mihaicotocel/Desktop/piper/audit-tracker && AUTH_DEV_BYPASS=1 NEXTAUTH_SECRET=anything npm run dev` → `http://localhost:3000`.

---

## 🔧 What only you can do (with the why)

| # | Step | Why I can't do it for you |
|---|---|---|
| 1 | Install Docker Desktop on your Mac (optional) | Drag-drop GUI install + admin password + Docker Hub sign-in. CI builds the container, so you can skip this if you trust the GitHub Actions image. |
| 2 | Sign in to GitHub | Browser-based interactive auth. |
| 3 | Sign in to Azure (`az login`) | Browser-based interactive auth. |
| 4 | Create the Azure resources | They're billed against *your* subscription — needs your account, your subscription ID, your client name. |
| 5 | Invite the client as a B2B Guest | Touches your Entra tenant. |

Use **Azure Cloud Shell** (https://shell.azure.com) for everything `az`-related — it's free, in-browser, and has `az`, `gh`, `bicep`, `docker`, `kubectl` pre-installed. You don't need to install Azure CLI on your Mac at all.

---

## Step 1 — GitHub: create the repo and push (5 min)

In your Terminal:

```bash
cd /Users/mihaicotocel/Desktop/piper/audit-tracker
gh auth login           # pick: GitHub.com → HTTPS → Yes (Git ops) → Login with a web browser
                         # then paste the one-time code into your browser
gh repo create audit-tracker --private --source=. --remote=origin --push
```

You should see:

```
✓ Created repository <your-username>/audit-tracker on GitHub
✓ Added remote https://github.com/<your-username>/audit-tracker.git
✓ Pushed commits to https://github.com/<your-username>/audit-tracker.git
```

Then enable branch protection (one-shot) and security settings:

```bash
gh repo edit --default-branch main \
  --enable-issues --enable-wiki=false \
  --delete-branch-on-merge

# Branch protection (requires GitHub Pro on private repos OR a public repo OR
# an organization plan; if your repo is private personal, skip this and add the
# rule manually in the GitHub UI)
gh api -X PUT "repos/{owner}/audit-tracker/branches/main/protection" \
  -F required_status_checks.strict=true \
  -f required_status_checks.contexts[]="build" \
  -F enforce_admins=true \
  -F required_pull_request_reviews.required_approving_review_count=1 \
  -F restrictions= 2>&1 | head -3 || true

# Dependabot + secret scanning + CodeQL (security tab)
gh api -X PATCH "repos/{owner}/audit-tracker" \
  -f security_and_analysis.secret_scanning.status=enabled \
  -f security_and_analysis.secret_scanning_push_protection.status=enabled
```

---

## Step 2 — Azure: open Cloud Shell and set up the tenant (one-time, 10 min)

Open https://shell.azure.com (sign in with your work account). When it asks, pick **Bash**.

In Cloud Shell:

```bash
# 2.1 Confirm subscription
az account show --query "{name:name, id:id, tenantId:tenantId}" -o table
# If wrong subscription, list & switch:
#   az account list --query "[].{name:name, id:id}" -o table
#   az account set --subscription "<SUB-ID>"

# 2.2 Capture IDs
SUB_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
echo "Sub:    $SUB_ID"
echo "Tenant: $TENANT_ID"

# 2.3 Create a security group for engagement leads (the Postgres Entra admin)
GROUP_OBJ_ID=$(az ad group create --display-name "audit-leads" --mail-nickname "audit-leads" --query id -o tsv)
az ad group member add --group "$GROUP_OBJ_ID" --member-id "$(az ad signed-in-user show --query id -o tsv)"
echo "Group: $GROUP_OBJ_ID"

# 2.4 Create the Microsoft Entra App Registration for the app
#     (sign-in-audience=AzureADMyOrg means only your tenant — guests still work)
APP_ID=$(az ad app create \
  --display-name "Audit Tracker" \
  --sign-in-audience AzureADMyOrg \
  --query appId -o tsv)
APP_OBJ_ID=$(az ad app show --id "$APP_ID" --query id -o tsv)
echo "App:        $APP_ID"
echo "App object: $APP_OBJ_ID"

# 2.5 Grant the app the basic OIDC scopes (User.Read on Microsoft Graph)
az ad app permission add --id "$APP_ID" \
  --api 00000003-0000-0000-c000-000000000000 \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope || true
az ad app permission grant --id "$APP_ID" \
  --api 00000003-0000-0000-c000-000000000000 \
  --scope "User.Read email openid profile" || true

# 2.6 GitHub Federated Identity Credential (no client secret on GitHub)
GH_OWNER="<your-github-username-or-org>"   # ← edit this
GH_REPO="audit-tracker"
az ad app federated-credential create --id "$APP_OBJ_ID" --parameters "{
  \"name\": \"github-deploy-main\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GH_OWNER}/${GH_REPO}:ref:refs/heads/main\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"
az ad app federated-credential create --id "$APP_OBJ_ID" --parameters "{
  \"name\": \"github-deploy-production\",
  \"issuer\": \"https://token.actions.githubusercontent.com\",
  \"subject\": \"repo:${GH_OWNER}/${GH_REPO}:environment:production\",
  \"audiences\": [\"api://AzureADTokenExchange\"]
}"

# 2.7 Save these — you'll paste them into GitHub repo secrets in step 3
echo
echo "=== Save these values ==="
echo "AZURE_SUBSCRIPTION_ID = $SUB_ID"
echo "AZURE_TENANT_ID       = $TENANT_ID"
echo "AZURE_CLIENT_ID       = $APP_ID         (== azureAdClientId in parameters)"
echo "AZURE_AD_TENANT_ID    = $TENANT_ID      (same value)"
echo "GROUP_OBJ_ID          = $GROUP_OBJ_ID   (postgresEntraAdminObjectId)"
```

---

## Step 3 — GitHub: add the secrets and variables (3 min)

Back in your local Terminal (or in Cloud Shell, but you'll need to `gh auth login` there too):

```bash
cd /Users/mihaicotocel/Desktop/piper/audit-tracker

# Replace with the values you saved from step 2
gh secret set AZURE_CLIENT_ID       --body "<APP_ID>"
gh secret set AZURE_TENANT_ID       --body "<TENANT_ID>"
gh secret set AZURE_SUBSCRIPTION_ID --body "<SUB_ID>"

# Variables that change per engagement (default is fine for first deploy)
CLIENT="acme"   # ← lowercase short name for the engagement
gh variable set AZURE_WEBAPP_NAME      --body "app-audit-${CLIENT}-prod"
gh variable set AZURE_RESOURCE_GROUP   --body "rg-audit-${CLIENT}-prod"
gh variable set GHCR_OWNER             --body "<your-github-username-or-org>"

# Create a 'production' GitHub environment for the deploy workflow
gh api -X PUT "repos/{owner}/audit-tracker/environments/production" \
  -F wait_timer=0 \
  -F prevent_self_review=false
```

---

## Step 4 — Azure Cloud Shell: deploy the engagement RG (15 min for first deploy)

Back in https://shell.azure.com:

```bash
# 4.1 Clone your repo into Cloud Shell
git clone https://github.com/<your-github-username>/audit-tracker.git
cd audit-tracker

# 4.2 Stash the NEXTAUTH_SECRET in a *bootstrap* Key Vault.
#     This vault holds the single secret the per-engagement Bicep references.
#     One-time per tenant.
BOOTSTRAP_KV="kv-audit-bootstrap-$(openssl rand -hex 3)"
BOOTSTRAP_RG="rg-audit-bootstrap"
az group create -n "$BOOTSTRAP_RG" -l eastus2
az keyvault create -n "$BOOTSTRAP_KV" -g "$BOOTSTRAP_RG" -l eastus2 \
  --enable-rbac-authorization true --enable-purge-protection true
# Grant yourself rights so the next az command can write the secret
ME=$(az ad signed-in-user show --query id -o tsv)
KV_ID=$(az keyvault show -n "$BOOTSTRAP_KV" --query id -o tsv)
az role assignment create --assignee "$ME" \
  --role "Key Vault Secrets Officer" --scope "$KV_ID"
sleep 30   # role propagation
# Paste the secret you saved earlier (or read it from .env.production.local on your Mac)
az keyvault secret set --vault-name "$BOOTSTRAP_KV" --name audit-tracker-nextauth-secret \
  --value "<paste the NEXTAUTH_SECRET value here>"

echo "Bootstrap KV: $BOOTSTRAP_KV"
echo "  resource id: $KV_ID"

# 4.3 Edit the parameters file for this client
cp infra/parameters.acme.json infra/parameters.${CLIENT}.json
nano infra/parameters.${CLIENT}.json   # or use the Cloud Shell file editor (pencil icon)
# Set:
#   clientSlug                    = "acme"     (or whatever)
#   postgresEntraAdminObjectId    = $GROUP_OBJ_ID from step 2.3
#   postgresEntraAdminLogin       = "audit-leads"
#   azureAdClientId               = $APP_ID    from step 2.4
#   azureAdTenantId               = $TENANT_ID
#   engagementName                = "Acme FY26 IT Audit"   (anything human-readable)
#   nextAuthSecret.reference.keyVault.id  = "$KV_ID"
#   nextAuthSecret.reference.secretName   = "audit-tracker-nextauth-secret"

# 4.4 Deploy
chmod +x infra/deploy.sh
./infra/deploy.sh ${CLIENT} prod
# This takes ~10 minutes — Postgres provisioning is the slow part.

# 4.5 Capture outputs
DEPLOY_NAME=$(az deployment sub list --query "[?contains(name,'audit-${CLIENT}')]|[-1].name" -o tsv)
APP_NAME=$(az deployment sub show -n "$DEPLOY_NAME" --query 'properties.outputs.appServiceName.value' -o tsv)
APP_PRINCIPAL=$(az webapp identity show -g "rg-audit-${CLIENT}-prod" -n "$APP_NAME" --query principalId -o tsv)
PG_NAME=$(az postgres flexible-server list -g "rg-audit-${CLIENT}-prod" --query "[0].name" -o tsv)
echo "App:           $APP_NAME"
echo "App principal: $APP_PRINCIPAL"
echo "Postgres:      $PG_NAME"

# 4.6 Add the App Service Managed Identity as a Postgres Entra principal
az postgres flexible-server ad-admin create \
  -g "rg-audit-${CLIENT}-prod" -s "$PG_NAME" \
  --display-name "$APP_NAME" --object-id "$APP_PRINCIPAL" --type ServicePrincipal

# 4.7 Connect to the database and grant the App Service identity table access.
#     az PostgreSQL execute uses your Entra token automatically.
PGHOST=$(az postgres flexible-server show -g "rg-audit-${CLIENT}-prod" -n "$PG_NAME" --query fullyQualifiedDomainName -o tsv)
TOKEN=$(az account get-access-token --resource-type oss-rdbms --query accessToken -o tsv)
SIGNED_IN_USER=$(az ad signed-in-user show --query userPrincipalName -o tsv)
PGPASSWORD="$TOKEN" psql "host=$PGHOST port=5432 dbname=audit user=$SIGNED_IN_USER sslmode=require" <<SQL
SELECT * FROM pgaadauth_create_principal_with_oid('$APP_NAME', '$APP_PRINCIPAL', 'service', false, false);
GRANT CONNECT ON DATABASE audit TO "$APP_NAME";
GRANT USAGE ON SCHEMA public TO "$APP_NAME";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "$APP_NAME";
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO "$APP_NAME";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$APP_NAME";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE ON SEQUENCES TO "$APP_NAME";
SQL

# 4.8 Add the Entra App Registration's redirect URI now that we know the App Service URL
APP_HOST=$(az webapp show -g "rg-audit-${CLIENT}-prod" -n "$APP_NAME" --query defaultHostName -o tsv)
az ad app update --id "$APP_ID" --web-redirect-uris "https://${APP_HOST}/api/auth/callback/microsoft-entra-id"
```

---

## Step 5 — GitHub Actions: trigger the first deploy (3 min)

In your local Terminal (or Cloud Shell):

```bash
gh workflow run deploy.yml -f tag=$(git rev-parse --short HEAD)
gh run watch
```

The workflow:
1. Builds the Docker image (the `Dockerfile` at the repo root).
2. Pushes it to `ghcr.io/<owner>/audit-tracker:<sha>`.
3. Points the App Service at the new image.
4. Waits for `/api/healthz` to return 200.

If the health check times out, check the App Service logs:

```bash
az webapp log tail -g "rg-audit-${CLIENT}-prod" -n "$APP_NAME"
```

---

## Step 6 — First sign-in + seed (5 min)

1. Open `https://app-audit-<client>-prod.azurewebsites.net/` in a private window.
2. Sign in with your work account (you're a member of the `audit-leads` group, so you become `auditor_lead` automatically).
3. Go to **Settings → Re-sync from Excel** and upload `IT_Audit_PBC_Tracker_v2.xlsx` (committed in the repo at `data/templates/`).
4. Verify the Dashboard shows 55 PBC items.

---

## Step 7 — Invite the client (2 min)

1. https://entra.microsoft.com → Identity → Users → "+ Invite external user"
2. Enter their email, display name, and a short message.
3. They get an email, click it, set up MFA in their tenant, and land on `/signin`. Their first sign-in creates a `client_reviewer` row.
4. Back in the app: **Settings → Users & roles** → change their role to `client_owner`.

---

## What I'll do once you're past step 5

If you give me back the deploy run URL or the `appServiceHostName` output, I can:
- Verify `/api/healthz`, sign in flow, role enforcement against the live URL.
- Write the per-row owner-mapping (e.g. populate `owner_client` for items the client is assigned to so they only see their items).
- Knock out the remaining hardening items (Front Door, private endpoints, Conditional Access policy, immutability/legal-hold).

If anything in steps 1–7 fails, paste the error here and I'll debug it.
