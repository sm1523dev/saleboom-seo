import { BlobServiceClient, generateBlobSASQueryParameters, BlobSASPermissions, StorageSharedKeyCredential } from "@azure/storage-blob";
import type { StorageProvider, UploadOpts } from "../types";

export class AzureBlobStorageProvider implements StorageProvider {
  private readonly serviceClient: BlobServiceClient;
  private readonly container: string;
  private readonly accountName: string;
  private readonly accountKey: string;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const container = process.env.AZURE_STORAGE_CONTAINER;

    if (!connectionString) {
      throw new Error(
        "AZURE_STORAGE_CONNECTION_STRING is required for STORAGE_PROVIDER=azure-blob"
      );
    }
    if (!container) {
      throw new Error(
        "AZURE_STORAGE_CONTAINER is required for STORAGE_PROVIDER=azure-blob"
      );
    }

    this.container = container;
    this.serviceClient = BlobServiceClient.fromConnectionString(connectionString);

    // Parse account name and key from connection string for SAS generation
    const accountNameMatch = connectionString.match(/AccountName=([^;]+)/);
    const accountKeyMatch = connectionString.match(/AccountKey=([^;]+)/);
    this.accountName = accountNameMatch?.[1] ?? "";
    this.accountKey = accountKeyMatch?.[1] ?? "";
  }

  private getContainerClient() {
    return this.serviceClient.getContainerClient(this.container);
  }

  async upload(key: string, data: Buffer, opts?: UploadOpts): Promise<string> {
    const containerClient = this.getContainerClient();
    await containerClient.createIfNotExists({ access: opts?.isPublic ? "blob" : undefined });

    const blobClient = containerClient.getBlockBlobClient(key);
    await blobClient.upload(data, data.length, {
      blobHTTPHeaders: { blobContentType: opts?.contentType ?? "application/octet-stream" },
      metadata: opts?.metadata,
    });

    return opts?.isPublic ? blobClient.url : key;
  }

  async download(key: string): Promise<Buffer> {
    const blobClient = this.getContainerClient().getBlockBlobClient(key);
    return blobClient.downloadToBuffer();
  }

  async delete(key: string): Promise<void> {
    await this.getContainerClient().getBlockBlobClient(key).deleteIfExists();
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const credential = new StorageSharedKeyCredential(this.accountName, this.accountKey);
    const expiresOn = new Date(Date.now() + expiresInSeconds * 1000);

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.container,
        blobName: key,
        permissions: BlobSASPermissions.parse("r"),
        expiresOn,
      },
      credential
    ).toString();

    const blobClient = this.getContainerClient().getBlockBlobClient(key);
    return `${blobClient.url}?${sasToken}`;
  }

  async exists(key: string): Promise<boolean> {
    return this.getContainerClient().getBlockBlobClient(key).exists();
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    for await (const blob of this.getContainerClient().listBlobsFlat({ prefix })) {
      keys.push(blob.name);
    }
    return keys;
  }
}
