import { promises as fs } from "fs";
import path from "path";
import type { StorageProvider, UploadOpts } from "../types";

const STORAGE_DIR = path.resolve(process.cwd(), "storage");

export class LocalStorageProvider implements StorageProvider {
  private async ensureDir(key: string): Promise<void> {
    await fs.mkdir(path.dirname(path.join(STORAGE_DIR, key)), { recursive: true });
  }

  async upload(key: string, data: Buffer, _opts?: UploadOpts): Promise<string> {
    await this.ensureDir(key);
    await fs.writeFile(path.join(STORAGE_DIR, key), data);
    return `/storage/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(path.join(STORAGE_DIR, key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(STORAGE_DIR, key), { force: true });
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    // Local dev: return a direct path (no expiry enforcement)
    return `/storage/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(STORAGE_DIR, key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = path.join(STORAGE_DIR, prefix);
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries
        .filter((e) => e.isFile())
        .map((e) => path.join(prefix, e.name));
    } catch {
      return [];
    }
  }
}
