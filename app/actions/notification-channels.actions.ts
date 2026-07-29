"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/db/schema";
import { encryptSecret } from "@/lib/secrets";
import { requireAdmin } from "@/lib/auth-utils";

type ChannelType = "email" | "slack" | "whatsapp";

type AddChannelInput = {
  channelType: ChannelType;
  name: string;
  provider: string;
  /** Primary credential: webhook URL for Slack, API key for Resend/SendGrid, SMTP user for email */
  key: string;
  /** Secondary credential (e.g. SMTP password); encrypted alongside key as JSON */
  secret?: string;
  config: Record<string, string>;
};

export async function addNotificationChannel(
  input: AddChannelInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    const credJson = JSON.stringify(
      input.secret
        ? { key: input.key.trim(), secret: input.secret.trim() }
        : { key: input.key.trim() },
    );
    const encryptedKeyBlob = input.key.trim() ? await encryptSecret(credJson) : null;

    await db.insert(notificationChannels).values({
      channelType: input.channelType,
      name: input.name.trim(),
      provider: input.provider,
      encryptedKeyBlob,
      config: input.config,
      enabled: true,
    });

    revalidatePath("/admin/providers");
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: msg };
  }
}

export async function removeNotificationChannel(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.delete(notificationChannels).where(eq(notificationChannels.id, id));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to remove channel" };
  }
}

export async function toggleNotificationChannel(
  id: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db
      .update(notificationChannels)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(notificationChannels.id, id));
    revalidatePath("/admin/providers");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to toggle channel" };
  }
}
