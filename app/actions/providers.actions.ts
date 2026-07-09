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

export async function switchInfraProvider(
  type: "ai" | "crawl" | "queue" | "storage" | "notifications",
  name: string,
  config: Record<string, string>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db
      .update(infraProviders)
      .set({ name, config, encryptedKeyBlob: null, updatedAt: new Date() })
      .where(eq(infraProviders.type, type));
    invalidateProviderCache(type);
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to switch provider" };
  }
}
