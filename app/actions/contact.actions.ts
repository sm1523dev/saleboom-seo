"use server";

import { z } from "zod";
import { getActiveChannels, dispatchToChannels } from "@/lib/notifications/channels";
import { getNotificationProvider } from "@/lib/notifications";
import { contactFormTemplate } from "@/lib/notifications/email-templates";

const ContactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters").max(2000),
});

export type ContactActionState = { error?: string; success?: boolean } | null;

export async function submitContactAction(
  _prev: ContactActionState,
  formData: FormData
): Promise<ContactActionState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    return { error: first?.message ?? "Invalid input" };
  }

  const { name, email, message } = parsed.data;
  const tpl = contactFormTemplate({ name, email, message });
  const slackText = `📬 *New contact form submission*\nFrom: ${name} <${email}>\n\n${message}`;

  void (async () => {
    try {
      const channels = await getActiveChannels();

      if (channels.length > 0) {
        // Dispatch to all configured channels (Slack + email) using the HTML template
        await dispatchToChannels(channels, { text: slackText, subject: tpl.subject, html: tpl.html });
        return;
      }

      // Fallback: env-var Slack webhook + ALERT_EMAIL_TO (the no-reply inbox)
      const tasks: Promise<void>[] = [];

      const slackWebhook = process.env.SLACK_ALERT_WEBHOOK;
      if (slackWebhook) {
        tasks.push(
          fetch(slackWebhook, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: slackText }),
          })
            .then(() => {})
            .catch(() => {})
        );
      }

      const alertEmail = process.env.ALERT_EMAIL_TO;
      if (alertEmail) {
        const recipients = alertEmail.split(",").map((e) => e.trim()).filter(Boolean);
        if (recipients.length > 0) {
          tasks.push(
            getNotificationProvider()
              .then((p) => p.sendEmail({ to: recipients, subject: tpl.subject, html: tpl.html, text: tpl.text }))
              .catch(() => {})
          );
        }
      }

      await Promise.all(tasks);
    } catch {
      // Non-fatal — form submission still succeeds
    }
  })();

  return { success: true };
}
