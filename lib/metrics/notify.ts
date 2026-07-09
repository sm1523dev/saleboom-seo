import { getNotificationProvider } from "@/lib/notifications";

export async function notifyAlert(message: string): Promise<void> {
  const slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
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
