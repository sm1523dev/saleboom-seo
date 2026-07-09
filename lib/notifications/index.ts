import type { NotificationProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";

function createByName(name: string, apiKey: string | undefined, config: Record<string, string>): NotificationProvider {
  switch (name) {
    case "resend":
      return new (require("./providers/resend").ResendNotificationProvider)(apiKey, config);
    case "sendgrid":
      return new (require(/* webpackIgnore: true */ "./providers/sendgrid").SendGridNotificationProvider)(apiKey);
    case "twilio":
      return new (require(/* webpackIgnore: true */ "./providers/twilio").TwilioNotificationProvider)(apiKey, config);
    case "ses":
      return new (require(/* webpackIgnore: true */ "./providers/aws-ses").AwsSesNotificationProvider)(apiKey, config);
    case "mock":
      return new (require("./providers/mock").MockNotificationProvider)();
    default:
      throw new Error(`Unknown notification provider: "${name}". Valid: resend, sendgrid, twilio, ses, mock`);
  }
}

function createFromEnv(): NotificationProvider {
  return createByName(process.env.NOTIFICATION_PROVIDER ?? "mock", undefined, {});
}

export async function getNotificationProvider(): Promise<NotificationProvider> {
  const resolved = await resolveInfraProvider("notifications");
  if (resolved) return createByName(resolved.name, resolved.key, resolved.config);
  return createFromEnv();
}

export type { NotificationProvider, EmailOpts, WhatsAppOpts } from "./types";
