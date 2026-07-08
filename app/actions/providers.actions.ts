"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function toggleAeoProvider(
  providerId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db
      .update(aeoProviders)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update provider" };
  }
}

export async function updateAeoProvider(
  providerId: string,
  data: {
    displayName: string;
    model: string;
    endpointUrl: string | null;
    apiKeyEnvVar: string | null;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db
      .update(aeoProviders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aeoProviders.id, providerId));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to update provider" };
  }
}
