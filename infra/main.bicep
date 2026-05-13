// Per-engagement deployment for the Audit Tracker.
// Deploys: Linux App Service (container) + Postgres Flexible Server (Entra-auth)
// + Storage Account (private blob) + Key Vault + Application Insights + Log Analytics.
//
// Run from the subscription scope:
//   az deployment sub create \
//     --location eastus2 \
//     --name "audit-${client}-$(date +%Y%m%d%H%M)" \
//     --template-file infra/main.bicep \
//     --parameters infra/parameters.${client}.json
//
// One Resource Group per engagement (hard isolation, easy spin-down).

targetScope = 'subscription'

@description('Short, lowercase, alphanumeric client slug, e.g. "acme".')
@minLength(2)
@maxLength(16)
param clientSlug string

@description('Environment suffix: prod | staging.')
@allowed(['prod','staging'])
param env string = 'prod'

@description('Primary Azure region.')
param location string = 'eastus2'

@description('App Service plan SKU. B1/B2 = Basic; S1/S2/S3 = Standard; P0v3/P1v3 = Premium V3. Choose by what your subscription has vCPU quota for.')
@allowed(['B1','B2','S1','S2','S3','P0v3','P1v3'])
param appPlanSku string = 'B2'

@description('Postgres Flexible Server SKU.')
@allowed(['Standard_B1ms','Standard_B2s','Standard_D2ds_v5'])
param postgresSku string = 'Standard_B1ms'

@description('Postgres storage size in GB.')
@allowed([32,64,128,256])
param postgresStorageGB int = 32

@description('Object id of the Entra group/user that should be the Postgres "Entra admin".')
param postgresEntraAdminObjectId string

@description('Display name for the Postgres Entra admin (used in the Azure portal only).')
param postgresEntraAdminLogin string

@description('Initial container image to deploy. Update via the GitHub Actions deploy workflow.')
param initialContainerImage string = 'ghcr.io/your-org/audit-tracker:bootstrap'

@description('Microsoft Entra App Registration (application) client ID for sign-in.')
param azureAdClientId string

@description('Microsoft Entra tenant ID.')
param azureAdTenantId string

@description('Optional: client secret for the App Registration. Leave empty to use Federated Identity Credential (preferred).')
@secure()
param azureAdClientSecret string = ''

@description('Public sign-in URL of the app, e.g. https://app-audit-acme.azurewebsites.net.')
param nextAuthUrl string = ''

@description('NextAuth signing secret. 32+ bytes random. Stored in Key Vault.')
@secure()
param nextAuthSecret string

@description('Engagement display name shown in the app.')
param engagementName string = 'IT Audit Engagement'

@description('Comma-separated emails who are auto-promoted to auditor_lead on first sign-in. Anyone NOT in this list (including B2B guests) defaults to client_reviewer.')
param auditorLeadBootstrapEmails string = ''

// ---- Resource Group ----
resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: 'rg-audit-${clientSlug}-${env}'
  location: location
}

// ---- Per-engagement workload ----
module workload 'workload.bicep' = {
  scope: rg
  name: 'workload'
  params: {
    location: location
    clientSlug: clientSlug
    env: env
    appPlanSku: appPlanSku
    postgresSku: postgresSku
    postgresStorageGB: postgresStorageGB
    postgresEntraAdminObjectId: postgresEntraAdminObjectId
    postgresEntraAdminLogin: postgresEntraAdminLogin
    initialContainerImage: initialContainerImage
    azureAdClientId: azureAdClientId
    azureAdTenantId: azureAdTenantId
    azureAdClientSecret: azureAdClientSecret
    nextAuthUrl: nextAuthUrl
    nextAuthSecret: nextAuthSecret
    engagementName: engagementName
    auditorLeadBootstrapEmails: auditorLeadBootstrapEmails
  }
}

output resourceGroupName string = rg.name
output appServiceHostName string = workload.outputs.appServiceHostName
output appServiceName string = workload.outputs.appServiceName
output postgresFqdn string = workload.outputs.postgresFqdn
output storageAccountName string = workload.outputs.storageAccountName
output keyVaultName string = workload.outputs.keyVaultName
output applicationInsightsConnectionString string = workload.outputs.applicationInsightsConnectionString
