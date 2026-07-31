import { eq, and } from "drizzle-orm";
import type { NotificationProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/secrets";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "notifications" });

export const DEFAULT_FROM =
  process.env.SMTP_FROM ?? "SaleBoom SEO <no-reply@saleboomllc.com>";

export function createNotificationProvider(
  name: string,
  apiKey: string | undefined,
  config: Record<string, string>,
): NotificationProvider {
  switch (name) {
    case "resend":
      return new (require("./providers/resend").ResendNotificationProvider)(apiKey, config);
    case "sendgrid":
      return new (require(/* webpackIgnore: true */ "./providers/sendgrid").SendGridNotificationProvider)(apiKey);
    case "twilio":
      return new (require(/* webpackIgnore: true */ "./providers/twilio").TwilioNotificationProvider)(apiKey, config);
    case "ses":
      return new (require(/* webpackIgnore: true */ "./providers/aws-ses").AwsSesNotificationProvider)(apiKey, config);
    case "smtp":
      return new (require("./providers/smtp").SmtpNotificationProvider)(apiKey, config);
    case "mock":
      return new (require("./providers/mock").MockNotificationProvider)();
    default:
      throw new Error(`Unknown notification provider: "${name}". Valid: resend, sendgrid, twilio, ses, smtp, mock`);
  }
}

/** @deprecated Use createNotificationProvider with an explicit name */
const createByName = createNotificationProvider;

function createFromEnv(): NotificationProvider {
  const name = process.env.NOTIFICATION_PROVIDER ?? "mock";
  if (name === "mock") {
    log.info("notification transport: mock (env default — console only)");
  }
  return createByName(name, undefined, {});
}

/**
 * Parse encrypted_key_blob value. SMTP credentials may be stored as
 * JSON `{ key, secret? }` (user + password); API-key providers store a plain string.
 */
function parseInfraKey(
  name: string,
  rawKey: string | undefined,
  config: Record<string, string>,
): { key: string | undefined; config: Record<string, string> } {
  if (!rawKey) return { key: undefined, config };

  if (name === "smtp") {
    try {
      const parsed = JSON.parse(rawKey) as { key?: string; secret?: string };
      if (parsed && typeof parsed.key === "string") {
        return {
          key: parsed.key,
          config: {
            ...config,
            ...(parsed.secret ? { pass: parsed.secret } : {}),
          },
        };
      }
    } catch {
      // Plain string — treat as SMTP user; pass may be in config
    }
  }

  return { key: rawKey, config };
}

async function resolveFromEmailChannel(): Promise<{
  name: string;
  key: string;
  config: Record<string, string>;
} | null> {
  const [row] = await db
    .select()
    .from(notificationChannels)
    .where(
      and(
        eq(notificationChannels.enabled, true),
        eq(notificationChannels.channelType, "email"),
      ),
    )
    .limit(1);

  if (!row?.encryptedKeyBlob) return null;

  try {
    const decrypted = await decryptSecret(row.encryptedKeyBlob);
    const creds = JSON.parse(decrypted) as { key: string; secret?: string };
    if (!creds.key) return null;

    const config: Record<string, string> = {
      ...((row.config ?? {}) as Record<string, string>),
      ...(creds.secret ? { pass: creds.secret } : {}),
    };

    return { name: row.provider, key: creds.key, config };
  } catch {
    return null;
  }
}

/**
 * Resolve the email transport provider.
 * Order: infra_providers (non-mock) → first enabled email Alert Channel → env → mock.
 * Prefer sendTransactionalEmail / sendAdminAlert from ./send for new call sites.
 */
export async function getNotificationProvider(): Promise<NotificationProvider> {
  const resolved = await resolveInfraProvider("notifications");

  if (resolved && resolved.name !== "mock") {
    const { key, config } = parseInfraKey(resolved.name, resolved.key, resolved.config);
    // SMTP needs credentials; API-key providers need a key
    const hasCreds =
      resolved.name === "smtp"
        ? Boolean(key && (config.pass || process.env.SMTP_PASS))
        : Boolean(key);
    if (hasCreds || resolved.name === "smtp") {
      try {
        return createByName(resolved.name, key, config);
      } catch (err) {
        log.warn("infra notifications provider failed, trying channel fallback", {
          error: String(err),
        });
      }
    }
  }

  const fromChannel = await resolveFromEmailChannel();
  if (fromChannel) {
    log.info("notification transport: email alert channel fallback", {
      provider: fromChannel.name,
    });
    try {
      return createByName(fromChannel.name, fromChannel.key, fromChannel.config);
    } catch (err) {
      log.warn("email channel transport failed, falling back to env", {
        error: String(err),
      });
    }
  }

  return createFromEnv();
}

export type { NotificationProvider, EmailOpts, WhatsAppOpts } from "./types";
