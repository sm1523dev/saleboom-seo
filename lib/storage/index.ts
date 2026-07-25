import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./providers/local";
import { S3StorageProvider } from "./providers/s3";
import { AzureBlobStorageProvider } from "./providers/azure-blob";
import { MockStorageProvider } from "./providers/mock";

function createProvider(): StorageProvider {
  const name = process.env.STORAGE_PROVIDER ?? "local";

  switch (name) {
    case "local":
      return new LocalStorageProvider();
    case "s3":
      return new S3StorageProvider();
    case "azure-blob":
      return new AzureBlobStorageProvider();
    case "mock":
      return new MockStorageProvider();
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER: "${name}". Valid: local, s3, azure-blob, mock`
      );
  }
}

export const storageProvider: StorageProvider = createProvider();
export type { StorageProvider, UploadOpts } from "./types";
