import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { infraProviders } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/secrets";

export type ResolvedProvider = {
  name: string;
  key: string | undefined;
  config: Record<string, string>;
};

// Per-type in-memory cache — 30s TTL for runtime-switchable providers
const CACHE = new Map<string, { value: ResolvedProvider; expiresAt: number }>();
const RUNTIME_TTL = 30_000;

export async function resolveInfraProvider(
  type: "ai" | "crawl" | "queue" | "storage" | "notifications",
  options: { cache?: boolean } = { cache: true },
): Promise<ResolvedProvider | null> {
  if (options.cache) {
    const now = Date.now();
    const cached = CACHE.get(type);
    if (cached && cached.expiresAt > now) return cached.value;
  }

  const [row] = await db
    .select()
    .from(infraProviders)
    .where(eq(infraProviders.type, type))
    .limit(1);

  if (!row) return null;

  const key = row.encryptedKeyBlob
    ? await decryptSecret(row.encryptedKeyBlob).catch(() => undefined)
    : undefined;

  const result: ResolvedProvider = {
    name: row.name,
    key,
    config: (row.config ?? {}) as Record<string, string>,
  };

  if (options.cache) {
    CACHE.set(type, { value: result, expiresAt: Date.now() + RUNTIME_TTL });
  }

  return result;
}

export function invalidateProviderCache(type: string) {
  CACHE.delete(type);
}
