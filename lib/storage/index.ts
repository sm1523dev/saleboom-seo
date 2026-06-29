import type { StorageProvider } from "./types";

function createProvider(): StorageProvider {
  const name = process.env.STORAGE_PROVIDER ?? "local";

  switch (name) {
    case "local":
      return new (require("./providers/local").LocalStorageProvider)();
    case "s3":
      return new (require("./providers/s3").S3StorageProvider)();
    case "azure-blob":
      return new (require("./providers/azure-blob").AzureBlobStorageProvider)();
    case "mock":
      return new (require("./providers/mock").MockStorageProvider)();
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER: "${name}". Valid: local, s3, azure-blob, mock`
      );
  }
}

export const storageProvider: StorageProvider = createProvider();
export type { StorageProvider, UploadOpts } from "./types";
