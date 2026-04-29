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

export function evidenceContainerName(): string {
  return process.env.EVIDENCE_CONTAINER || 'evidence';
}

let _containerEnsured: Promise<ContainerClient> | null = null;
export function evidenceContainer(): Promise<ContainerClient> {
  if (_containerEnsured) return _containerEnsured;
  _containerEnsured = (async () => {
    const c = blobService().getContainerClient(evidenceContainerName());
    await c.createIfNotExists();
    return c;
  })();
  return _containerEnsured;
}

/**
 * Generate a short-lived SAS URL for downloading a blob.
 *
 * - With an account key (Azurite, or an explicit connection string): use shared key.
 * - With Managed Identity (Azure prod): use a user-delegation key.
 */
export async function downloadSasUrl(blobName: string, ttlSeconds = 30): Promise<string> {
  const service = blobService();
  const containerName = evidenceContainerName();
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
      protocol: _isAzurite ? undefined : undefined,
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
