import type { StorageProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";
import { LocalStorageProvider } from "./providers/local";
import { S3StorageProvider } from "./providers/s3";
import { AzureBlobStorageProvider } from "./providers/azure-blob";
import { MockStorageProvider } from "./providers/mock";

function createByName(name: string): StorageProvider {
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
      throw new Error(`Unknown storage provider: "${name}". Valid: local, s3, azure-blob, mock`);
  }
}

let _instance: StorageProvider | null = null;

export async function getStorageProvider(): Promise<StorageProvider> {
  if (_instance) return _instance;
  const resolved = await resolveInfraProvider("storage");
  const name = resolved?.name ?? process.env.STORAGE_PROVIDER ?? "local";
  _instance = createByName(name);
  return _instance;
}

export type { StorageProvider, UploadOpts } from "./types";
