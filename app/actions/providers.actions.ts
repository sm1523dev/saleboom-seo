"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, infraProviders } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";
import { encryptSecret } from "@/lib/secrets";
import { invalidateProviderCache } from "@/lib/providers/resolver";
import { revalidatePath } from "next/cache";

// ── AEO Providers ──────────────────────────────────────────────────────────────

export async function toggleAeoProvider(
  providerId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.update(aeoProviders).set({ enabled, updatedAt: new Date() }).where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update provider" };
  }
}

export async function deleteAeoProvider(
  providerId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.delete(aeoProviders).where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to delete provider" };
  }
}

export async function updateAeoProvider(
  providerId: string,
  data: { displayName: string; model: string; endpointUrl: string | null; apiKeyEnvVar: string | null },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.update(aeoProviders).set({ ...data, updatedAt: new Date() }).where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update provider" };
  }
}

export async function setAeoProviderKey(
  providerId: string,
  plainKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const blob = plainKey.trim() ? await encryptSecret(plainKey.trim()) : null;
    await db.update(aeoProviders).set({ encryptedKeyBlob: blob, updatedAt: new Date() }).where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save provider key" };
  }
}

export async function addAeoProvider(data: {
  displayName: string;
  providerType: string;
  model: string;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  plainKey: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const blob = data.plainKey?.trim() ? await encryptSecret(data.plainKey.trim()) : null;
    await db.insert(aeoProviders).values({
      displayName: data.displayName.trim(),
      providerType: data.providerType.trim(),
      model: data.model.trim(),
      endpointUrl: data.endpointUrl?.trim() || null,
      apiKeyEnvVar: data.apiKeyEnvVar?.trim() || null,
      encryptedKeyBlob: blob,
      enabled: true,
    });
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to add provider" };
  }
}

// ── Infra Providers ────────────────────────────────────────────────────────────

export async function setInfraProviderKey(
  type: "ai" | "crawl" | "queue" | "storage" | "notifications",
  plainKey: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const blob = plainKey.trim() ? await encryptSecret(plainKey.trim()) : null;
    await db
      .update(infraProviders)
      .set({ encryptedKeyBlob: blob, updatedAt: new Date() })
      .where(eq(infraProviders.type, type));
    invalidateProviderCache(type);
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save key" };
  }
}

/** Store SMTP user+password (or API key + optional secret) as JSON in encrypted_key_blob. */
export async function setInfraProviderCredentials(
  type: "ai" | "crawl" | "queue" | "storage" | "notifications",
  creds: { key: string; secret?: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    const key = creds.key.trim();
    if (!key) {
      await db
        .update(infraProviders)
        .set({ encryptedKeyBlob: null, updatedAt: new Date() })
        .where(eq(infraProviders.type, type));
    } else {
      const payload = JSON.stringify(
        creds.secret?.trim()
          ? { key, secret: creds.secret.trim() }
          : { key },
      );
      const blob = await encryptSecret(payload);
      await db
        .update(infraProviders)
        .set({ encryptedKeyBlob: blob, updatedAt: new Date() })
        .where(eq(infraProviders.type, type));
    }
    invalidateProviderCache(type);
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to save credentials" };
  }
}

export async function switchInfraProvider(
  type: "ai" | "crawl" | "queue" | "storage" | "notifications",
  name: string,
  config: Record<string, string>,
  options?: { keepKey?: boolean },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const [existing] = await db
      .select({ id: infraProviders.id })
      .from(infraProviders)
      .where(eq(infraProviders.type, type))
      .limit(1);

    if (existing) {
      const updates: {
        name: string;
        config: Record<string, string>;
        encryptedKeyBlob?: null;
        updatedAt: Date;
      } = {
        name,
        config,
        updatedAt: new Date(),
      };
      if (!options?.keepKey) {
        updates.encryptedKeyBlob = null;
      }
      await db
        .update(infraProviders)
        .set(updates)
        .where(eq(infraProviders.type, type));
    } else {
      await db.insert(infraProviders).values({
        type,
        name,
        config,
        encryptedKeyBlob: null,
        switchMode: "runtime",
      });
    }

    invalidateProviderCache(type);
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch provider" };
  }
}

