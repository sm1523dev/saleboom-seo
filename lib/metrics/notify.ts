import { getActiveChannels, dispatchToChannels } from "@/lib/notifications/channels";
import { getNotificationProvider } from "@/lib/notifications";

export async function notifyAlert(message: string): Promise<void> {
  const html = `<p>${message.replace(/\n/g, "<br>")}</p>`;
  const subject = "SaleBoom SEO Alert";
  const text = `🚨 SaleBoom SEO Alert\n${message}`;

  const channels = await getActiveChannels();

  if (channels.length > 0) {
    await dispatchToChannels(channels, {
      text: `🚨 *SaleBoom SEO Alert*\n${message}`,
      subject,
      html,
    });
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
        body: JSON.stringify({ text }),
      })
        .then(() => {})
        .catch(() => {}),
    );
  }

  const alertEmail = process.env.ALERT_EMAIL_TO;
  if (alertEmail) {
    const recipients = alertEmail.split(",").map((e) => e.trim()).filter(Boolean);
    if (recipients.length > 0) {
      tasks.push(
        getNotificationProvider()
          .then((p) => p.sendEmail({ to: recipients, subject, html, text: message }))
          .catch(() => {}),
      );
    }
  }

  await Promise.all(tasks);
}
