import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { getNotificationProvider } from "@/lib/notifications";

async function resolveSlackWebhook(): Promise<string | null> {
  const envUrl = process.env.SLACK_ALERT_WEBHOOK;
  if (envUrl) return envUrl;
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "notification_slack_webhook"))
    .limit(1);
  return row?.value || null;
}

export async function notifyAlert(message: string): Promise<void> {
  const slackWebhook = await resolveSlackWebhook();
  const alertEmail = process.env.ALERT_EMAIL_TO;

  const tasks: Promise<void>[] = [];

  if (slackWebhook) {
    tasks.push(
      fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `🚨 *SaleBoom SEO Alert*\n${message}` }),
      })
        .then(() => {})
        .catch(() => {})
    );
  }

  if (alertEmail) {
    const recipients = alertEmail.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length > 0) {
      tasks.push(
        getNotificationProvider()
          .then((p) =>
            p.sendEmail({
              to: recipients,
              subject: "SaleBoom SEO Alert",
              html: `<p>${message.replace(/\n/g, "<br>")}</p>`,
              text: message,
            })
          )
          .catch(() => {})
      );
    }
  }

  await Promise.all(tasks);
}
