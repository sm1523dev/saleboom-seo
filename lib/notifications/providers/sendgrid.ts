import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class SendGridNotificationProvider implements NotificationProvider {
  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error("SENDGRID_API_KEY is required for NOTIFICATION_PROVIDER=sendgrid");

    const sgMail = require("@sendgrid/mail");
    sgMail.setApiKey(apiKey);
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    const sgMail = require("@sendgrid/mail");
    const defaultFrom = process.env.SENDGRID_FROM ?? "noreply@saleboom.com";

    await sgMail.send({
      from: opts.from ?? defaultFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }

  async sendWhatsApp(_opts: WhatsAppOpts): Promise<void> {
    throw new Error("SendGrid does not support WhatsApp. Use NOTIFICATION_PROVIDER=twilio instead.");
  }
}
