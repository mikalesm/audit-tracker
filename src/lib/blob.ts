import {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions,
  ContainerSASPermissions,
  type ContainerClient,
} from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

/**
 * Returns a BlobServiceClient configured for the current environment.
 *
 *  - Local dev (no AZURE_STORAGE_ACCOUNT or AZURE_STORAGE_CONNECTION_STRING set):
 *    falls back to the Azurite well-known development connection string.
 *  - Local dev with explicit connection string: uses it.
 *  - Azure: uses Managed Identity via DefaultAzureCredential when only the account name is set.
 */
let _service: BlobServiceClient | null = null;
let _accountName: string | null = null;
let _accountKey: string | null = null;
let _isAzurite = false;

const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;' +
  'AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;' +
  'BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';

export function blobService(): BlobServiceClient {
  if (_service) return _service;

  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  const account = process.env.AZURE_STORAGE_ACCOUNT;

  if (conn) {
    _service = BlobServiceClient.fromConnectionString(conn);
    const m = /AccountName=([^;]+);AccountKey=([^;]+)/.exec(conn);
    if (m) { _accountName = m[1]; _accountKey = m[2]; }
    _isAzurite = /devstoreaccount1/i.test(conn);
    return _service;
  }
  if (account) {
    _service = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new DefaultAzureCredential());
    _accountName = account;
    return _service;
  }
  // Fallback: Azurite (local dev convenience)
  _service = BlobServiceClient.fromConnectionString(AZURITE_CONNECTION_STRING);
  _accountName = 'devstoreaccount1';
  _accountKey = 'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';
  _isAzurite = true;
  return _service;
}

/**
 * Each engagement gets its own blob container. Azure storage account names can
 * have hundreds of containers; we use `evidence-eng-<id>` so a future bug that
 * accidentally writes to the wrong engagement's container is at least visible
 * in the Azure portal and easy to grep for.
 *
 * Defensive guard: engagementId MUST be a positive integer derived from the DB
 * (BIGSERIAL). This rejects bogus inputs (0, negative, non-finite) that could
 * otherwise normalise to a container that another engagement might write to.
 * Container names are immutable for the lifetime of the engagement.
 */
export function containerNameFor(engagementId: number): string {
  if (!Number.isInteger(engagementId) || engagementId <= 0) {
    throw new Error(`refusing to build container name for invalid engagementId: ${engagementId}`);
  }
  return `evidence-eng-${engagementId}`;
}

const _ensuredContainers = new Map<number, Promise<ContainerClient>>();
export function evidenceContainerFor(engagementId: number): Promise<ContainerClient> {
  const cached = _ensuredContainers.get(engagementId);
  if (cached) return cached;
  const p = (async () => {
    const c = blobService().getContainerClient(containerNameFor(engagementId));
    await c.createIfNotExists();
    return c;
  })();
  _ensuredContainers.set(engagementId, p);
  return p;
}

/**
 * Generate a short-lived SAS URL for downloading a blob.
 *
 * - With an account key (Azurite, or an explicit connection string): use shared key.
 * - With Managed Identity (Azure prod): use a user-delegation key.
 */
export async function downloadSasUrl(
  engagementId: number,
  blobName: string,
  ttlSeconds = 30,
): Promise<string> {
  const service = blobService();
  const containerName = containerNameFor(engagementId);
  const blobClient = service.getContainerClient(containerName).getBlobClient(blobName);
  const expiresOn = new Date(Date.now() + ttlSeconds * 1000);
  const startsOn = new Date(Date.now() - 60 * 1000);

  if (_accountKey && _accountName) {
    const cred = new StorageSharedKeyCredential(_accountName, _accountKey);
    const sas = generateBlobSASQueryParameters({
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn,
      expiresOn,
    }, cred).toString();
    return `${blobClient.url}?${sas}`;
  }

  // Managed Identity path: user-delegation key
  const udk = await service.getUserDelegationKey(startsOn, expiresOn);
  const sas = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: ContainerSASPermissions.parse('r'),
    startsOn,
    expiresOn,
  }, udk, _accountName ?? '').toString();
  return `${blobClient.url}?${sas}`;
}
