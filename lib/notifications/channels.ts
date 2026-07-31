import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/secrets";
import { logger } from "@/lib/logger";
import { DEFAULT_FROM, getNotificationProvider } from "./index";

const log = logger.child({ component: "notification-channels" });

export type ResolvedChannel = {
  id: string;
  name: string;
  channelType: "email" | "slack" | "whatsapp";
  provider: string;
  key: string;
  secret?: string;
  config: Record<string, string>;
};

export async function getActiveChannels(): Promise<ResolvedChannel[]> {
  const rows = await db
    .select()
    .from(notificationChannels)
    .where(eq(notificationChannels.enabled, true));

  const resolved = await Promise.all(
    rows.map(async (row) => {
      if (!row.encryptedKeyBlob) return null;
      try {
        const decrypted = await decryptSecret(row.encryptedKeyBlob);
        const creds = JSON.parse(decrypted) as { key: string; secret?: string };
        const resolved: ResolvedChannel = {
          id: row.id,
          name: row.name,
          channelType: row.channelType,
          provider: row.provider,
          key: creds.key,
          config: (row.config ?? {}) as Record<string, string>,
        };
        if (creds.secret) resolved.secret = creds.secret;
        return resolved;
      } catch {
        return null;
      }
    }),
  );

  return resolved.filter((ch): ch is ResolvedChannel => ch !== null);
}

export async function dispatchToChannels(
  channels: ResolvedChannel[],
  opts: { text: string; subject: string; html: string },
): Promise<void> {
  await Promise.all(
    channels.map(async (ch) => {
      try {
        if (ch.channelType === "slack") {
          await fetch(ch.key, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: opts.text }),
          });
          return;
        }

        if (ch.channelType === "email") {
          const to = ch.config.to;
          if (!to) {
            log.warn("email channel missing config.to — skipping", {
              channelId: ch.id,
              channelName: ch.name,
            });
            return;
          }
          const recipients = to.split(",").map((e) => e.trim()).filter(Boolean);
          if (recipients.length === 0) {
            log.warn("email channel config.to empty after parse — skipping", {
              channelId: ch.id,
              channelName: ch.name,
            });
            return;
          }
          // Use shared transport (infra / channel fallback / env), not per-channel SMTP
          const provider = await getNotificationProvider();
          const from = ch.config.from?.trim() || DEFAULT_FROM;
          await provider.sendEmail({
            to: recipients,
            subject: opts.subject,
            html: opts.html,
            text: opts.text,
            from,
          });
          return;
        }
      } catch (err) {
        log.warn("channel dispatch failed", {
          channelId: ch.id,
          channelName: ch.name,
          channelType: ch.channelType,
          error: String(err),
        });
      }
    }),
  );
}
