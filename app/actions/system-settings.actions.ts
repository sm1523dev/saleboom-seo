"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";

export const SETTINGS_KEYS = {
  SLACK_WEBHOOK: "notification_slack_webhook",
  SUPPORT_EMAIL: "notification_support_email",
  RESPONSE_WINDOW: "notification_response_window",
} as const;

export async function getSystemSettings(): Promise<Record<string, string>> {
  const rows = await db.select().from(systemSettings);
  return Object.fromEntries(rows.map((r) => [r.key, r.value ?? ""]));
}

export type SettingsState = { error?: string; success?: string } | null;

export async function saveNotificationSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await requireAdmin();

  const updates: { key: string; value: string }[] = [
    { key: SETTINGS_KEYS.SLACK_WEBHOOK, value: (formData.get("slackWebhook") as string ?? "").trim() },
    { key: SETTINGS_KEYS.SUPPORT_EMAIL, value: (formData.get("supportEmail") as string ?? "").trim() },
    { key: SETTINGS_KEYS.RESPONSE_WINDOW, value: (formData.get("responseWindow") as string ?? "24-72 hours").trim() },
  ];

  for (const { key, value } of updates) {
    await db
      .insert(systemSettings)
      .values({ key, value, updatedBy: session.user.id })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedAt: new Date(), updatedBy: session.user.id },
      });
  }

  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}
