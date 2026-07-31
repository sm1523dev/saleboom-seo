"use server";

import { z } from "zod";
import { contactFormTemplate } from "@/lib/notifications/email-templates";
import { sendAdminAlert } from "@/lib/notifications/send";

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

  void sendAdminAlert({
    text: slackText,
    subject: tpl.subject,
    html: tpl.html,
  }).catch(() => {
    // Non-fatal — form submission still succeeds
  });

  return { success: true };
}
