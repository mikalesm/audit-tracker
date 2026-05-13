// Resource-group-scoped module that creates everything inside the engagement's RG.

targetScope = 'resourceGroup'

param location string
param clientSlug string
param env string
param appPlanSku string
param postgresSku string
param postgresStorageGB int
param postgresEntraAdminObjectId string
param postgresEntraAdminLogin string
param initialContainerImage string
param azureAdClientId string
param azureAdTenantId string
@secure()
param azureAdClientSecret string
param nextAuthUrl string
@secure()
param nextAuthSecret string
param engagementName string
param auditorLeadBootstrapEmails string = ''

// Storage account names must be 3-24 chars, lowercase + digits only.
// Hash 6 chars off the RG id so two engagements never collide.
var hashSuffix = uniqueString(resourceGroup().id)
var storageName = toLower('staudit${take(clientSlug, 8)}${take(hashSuffix, 6)}')
var appPlanName = 'asp-audit-${clientSlug}-${env}'
var appName     = 'app-audit-${clientSlug}-${env}'
var pgName      = 'psql-audit-${clientSlug}-${env}'
var kvName      = take('kv-audit-${clientSlug}-${take(hashSuffix, 6)}', 24)
var laName      = 'log-audit-${clientSlug}-${env}'
var aiName      = 'appi-audit-${clientSlug}-${env}'

// ---- Log Analytics ----
resource la 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: laName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ---- Application Insights (workspace-based) ----
resource ai 'Microsoft.Insights/components@2020-02-02' = {
  name: aiName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: la.id
  }
}

// ---- Storage Account ----
resource storage 'Microsoft.Storage/storageAccounts@2024-01-01' = {
  name: storageName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    publicNetworkAccess: 'Enabled' // tighten with private endpoints in hardening phase
    supportsHttpsTrafficOnly: true
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2024-01-01' = {
  parent: storage
  name: 'default'
  properties: {
    isVersioningEnabled: true
    deleteRetentionPolicy: { enabled: true, days: 30 }
    containerDeleteRetentionPolicy: { enabled: true, days: 30 }
  }
}

resource evidenceContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2024-01-01' = {
  parent: blobService
  name: 'evidence'
  properties: { publicAccess: 'None' }
}

// ---- Key Vault ----
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled' // tighten in hardening phase
  }
}

resource kvNextAuthSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: kv
  name: 'NEXTAUTH-SECRET'
  properties: { value: nextAuthSecret }
}

resource kvAdSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(azureAdClientSecret)) {
  parent: kv
  name: 'AZURE-AD-CLIENT-SECRET'
  properties: { value: azureAdClientSecret }
}

// ---- Postgres Flexible Server ----
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: pgName
  location: location
  sku: {
    name: postgresSku
    tier: contains(postgresSku, 'Standard_B') ? 'Burstable' : 'GeneralPurpose'
  }
  properties: {
    version: '16'
    storage: { storageSizeGB: postgresStorageGB }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Enabled'
    }
    highAvailability: { mode: 'Disabled' }
    network: { publicNetworkAccess: 'Enabled' } // tighten with private endpoint in hardening
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Disabled'
      tenantId: subscription().tenantId
    }
  }
}

// Allow Azure services + your office IP at provisioning time;
// real production uses a private endpoint and removes these.
resource pgFwAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: pg
  name: 'AllowAllAzureServicesAndResourcesWithinAzureIps'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

// Entra admin (your engagement-lead group; or a single user).
// `dependsOn pgFwAzure` is a workaround for a known transient issue where the
// AAD-admin sub-resource fires before the server is fully accessible:
//   "AadAuthOperationCannotBePerformedWhenServerIsNotAccessible"
// Sequencing it after the firewall rule forces the server to finish waking up.
resource pgAadAdmin 'Microsoft.DBforPostgreSQL/flexibleServers/administrators@2024-08-01' = {
  parent: pg
  name: postgresEntraAdminObjectId
  properties: {
    principalType: 'Group'
    principalName: postgresEntraAdminLogin
    tenantId: subscription().tenantId
  }
  dependsOn: [
    pgFwAzure
  ]
}

resource pgDb 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: pg
  name: 'audit'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// ---- App Service Plan ----
var appPlanTier = startsWith(appPlanSku, 'B')
  ? 'Basic'
  : (startsWith(appPlanSku, 'S') ? 'Standard' : 'PremiumV3')

resource asp 'Microsoft.Web/serverfarms@2024-04-01' = {
  name: appPlanName
  location: location
  kind: 'linux'
  sku: { name: appPlanSku, tier: appPlanTier }
  properties: { reserved: true }
}

// ---- App Service (container) ----
resource app 'Microsoft.Web/sites@2024-04-01' = {
  name: appName
  location: location
  kind: 'app,linux,container'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: asp.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${initialContainerImage}'
      alwaysOn: !startsWith(appPlanSku, 'B') // Basic SKUs don't allow alwaysOn
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      healthCheckPath: '/api/healthz'
      acrUseManagedIdentityCreds: false
      appSettings: [
        { name: 'WEBSITES_PORT', value: '3000' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'WEBSITES_CONTAINER_START_TIME_LIMIT', value: '600' }
        { name: 'NEXT_TELEMETRY_DISABLED', value: '1' }
        { name: 'NODE_ENV', value: 'production' }
        // Postgres — Entra-auth via Managed Identity. The container entrypoint
        // mints a fresh AAD token (oss-rdbms scope) and the pg.Pool refreshes
        // it on each new connection. No password is ever stored.
        { name: 'PGHOST', value: pg.properties.fullyQualifiedDomainName }
        { name: 'PGPORT', value: '5432' }
        { name: 'PGDATABASE', value: pgDb.name }
        { name: 'PGUSER', value: appName }
        { name: 'PGSSLMODE', value: 'require' }
        // Storage
        { name: 'AZURE_STORAGE_ACCOUNT', value: storage.name }
        { name: 'EVIDENCE_CONTAINER', value: 'evidence' }
        // Auth
        { name: 'NEXTAUTH_URL', value: empty(nextAuthUrl) ? 'https://${appName}.azurewebsites.net' : nextAuthUrl }
        { name: 'NEXTAUTH_SECRET', value: '@Microsoft.KeyVault(SecretUri=${kvNextAuthSecret.properties.secretUri})' }
        { name: 'AZURE_AD_CLIENT_ID', value: azureAdClientId }
        { name: 'AZURE_AD_TENANT_ID', value: azureAdTenantId }
        // First-user bootstrap: anyone in this list (case-insensitive) becomes
        // auditor_lead on first sign-in iff no auditor_lead exists yet. Everyone
        // else (notably B2B guests) defaults to client_reviewer.
        { name: 'AUDITOR_LEAD_BOOTSTRAP_EMAILS', value: auditorLeadBootstrapEmails }
        // Engagement metadata
        { name: 'ENGAGEMENT_NAME', value: engagementName }
        // App Insights
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: ai.properties.ConnectionString }
        { name: 'ApplicationInsightsAgent_EXTENSION_VERSION', value: '~3' }
      ]
    }
  }
}

// Conditional: AZURE_AD_CLIENT_SECRET only if a non-empty secret was provided.
resource appSecretSetting 'Microsoft.Web/sites/config@2024-04-01' = if (!empty(azureAdClientSecret)) {
  parent: app
  name: 'appsettings'
  properties: {
    AZURE_AD_CLIENT_SECRET: '@Microsoft.KeyVault(SecretUri=${kvAdSecret.properties.secretUri})'
  }
}

// ---- RBAC: App Service MI → Storage Blob Data Contributor ----
var blobDataContribRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
resource appStorageRA 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, app.id, blobDataContribRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', blobDataContribRoleId)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---- RBAC: App Service MI → Key Vault Secrets User ----
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
resource appKvRA 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, app.id, kvSecretsUserRoleId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: app.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---- Outputs ----
output appServiceName string = app.name
output appServiceHostName string = app.properties.defaultHostName
output postgresFqdn string = pg.properties.fullyQualifiedDomainName
output postgresName string = pg.name
output postgresAppLogin string = appName
output storageAccountName string = storage.name
output keyVaultName string = kv.name
output applicationInsightsConnectionString string = ai.properties.ConnectionString
output appPrincipalId string = app.identity.principalId
