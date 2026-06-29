import { promises as fs } from "fs";
import path from "path";
import type { StorageProvider, UploadOpts } from "../types";

const STORAGE_DIR = path.resolve(process.cwd(), "storage");

function safeResolve(key: string): string {
  const resolved = path.resolve(STORAGE_DIR, key);
  if (!resolved.startsWith(STORAGE_DIR + path.sep) && resolved !== STORAGE_DIR) {
    throw new Error(`Invalid storage key: "${key}"`);
  }
  return resolved;
}

export class LocalStorageProvider implements StorageProvider {
  private async ensureDir(resolved: string): Promise<void> {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
  }

  async upload(key: string, data: Buffer, _opts?: UploadOpts): Promise<string> {
    const resolved = safeResolve(key);
    await this.ensureDir(resolved);
    await fs.writeFile(resolved, data);
    return `/storage/${key}`;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(safeResolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(safeResolve(key), { force: true });
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    safeResolve(key);
    return `/storage/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(safeResolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string): Promise<string[]> {
    const dir = safeResolve(prefix.endsWith("/") ? prefix : prefix + "/x").replace(/\/x$/, "");
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
