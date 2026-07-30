"use server";

import { z } from "zod";
import { getNotificationProvider } from "@/lib/notifications";
import { notifyAlert } from "@/lib/metrics/notify";
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

  const adminEmail = process.env.ADMIN_CONTACT_EMAIL ?? process.env.ALERT_EMAIL_TO ?? "";
  const recipients = adminEmail.split(",").map((e) => e.trim()).filter(Boolean);

  const tpl = contactFormTemplate({ name, email, message });

  await Promise.all([
    recipients.length > 0
      ? getNotificationProvider()
          .then((p) => p.sendEmail({ to: recipients, subject: tpl.subject, html: tpl.html, text: tpl.text }))
          .catch(() => {})
      : Promise.resolve(),
    notifyAlert(`New contact form submission from ${name} <${email}>\n\n${message}`).catch(() => {}),
  ]);

  return { success: true };
}
