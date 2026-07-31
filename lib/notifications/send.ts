import { getActiveChannels, dispatchToChannels } from "./channels";
import { getNotificationProvider, DEFAULT_FROM } from "./index";
import { resolveInfraProvider } from "@/lib/providers/resolver";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "notifications" });

export { DEFAULT_FROM };

async function resolveFromAddress(): Promise<string> {
  const resolved = await resolveInfraProvider("notifications");
  const fromConfig = resolved?.config?.from?.trim();
  if (fromConfig) return fromConfig;
  return DEFAULT_FROM;
}

export async function sendTransactionalEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const [provider, from] = await Promise.all([
    getNotificationProvider(),
    resolveFromAddress(),
  ]);
  await provider.sendEmail({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    from,
  });
}

export async function sendAdminAlert(opts: {
  text: string;
  subject: string;
  html: string;
}): Promise<void> {
  const channels = await getActiveChannels();

  if (channels.length > 0) {
    await dispatchToChannels(channels, opts);
    return;
  }

  // Legacy fallback: env vars only, no channels configured yet
  const tasks: Promise<void>[] = [];

  const slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
  if (slackWebhook) {
    tasks.push(
      fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: opts.text }),
      })
        .then(() => {})
        .catch((err) => {
          log.warn("slack env webhook failed", { error: String(err) });
        }),
    );
  }

  const alertEmail = process.env.ALERT_EMAIL_TO;
  if (alertEmail) {
    const recipients = alertEmail.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length > 0) {
      tasks.push(
        sendTransactionalEmail({
          to: recipients,
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }).catch((err) => {
          log.warn("alert email env fallback failed", { error: String(err) });
        }),
      );
    }
  }

  if (tasks.length === 0) {
    log.warn("sendAdminAlert: no channels and no env fallback configured");
  }

  await Promise.all(tasks);
}
