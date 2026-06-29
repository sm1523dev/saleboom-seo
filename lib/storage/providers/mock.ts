import type { StorageProvider, UploadOpts } from "../types";

export class MockStorageProvider implements StorageProvider {
  private readonly store = new Map<string, Buffer>();

  async upload(key: string, data: Buffer, _opts?: UploadOpts): Promise<string> {
    this.store.set(key, data);
    console.log(`[storage:mock] upload key=${key} size=${data.length}B`);
    return `/mock-storage/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    const data = this.store.get(key);
    if (!data) throw new Error(`[storage:mock] key not found: ${key}`);
    return data;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    console.log(`[storage:mock] delete key=${key}`);
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return `/mock-storage/${key}?signed=true`;
  }

  async exists(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
}
