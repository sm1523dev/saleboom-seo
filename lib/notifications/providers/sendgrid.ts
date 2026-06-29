import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class SendGridNotificationProvider implements NotificationProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly sgMail: any;
  private readonly defaultFrom: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error("SENDGRID_API_KEY is required for NOTIFICATION_PROVIDER=sendgrid");

    this.sgMail = require("@sendgrid/mail");
    this.sgMail.setApiKey(apiKey);
    this.defaultFrom = process.env.SENDGRID_FROM ?? "noreply@saleboom.com";
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    await this.sgMail.send({
      from: opts.from ?? this.defaultFrom,
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
