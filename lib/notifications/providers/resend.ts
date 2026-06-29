import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class ResendNotificationProvider implements NotificationProvider {
  private readonly client: import("resend").Resend;
  private readonly defaultFrom: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required for NOTIFICATION_PROVIDER=resend");

    const { Resend } = require("resend") as typeof import("resend");
    this.client = new Resend(apiKey);
    this.defaultFrom = process.env.RESEND_FROM ?? "SaleBoom SEO <noreply@saleboom.com>";
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    const { error } = await this.client.emails.send({
      from: opts.from ?? this.defaultFrom,
      to: typeof opts.to === "string" ? [opts.to] : opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });

    if (error) throw new Error(`Resend error: ${error.message}`);
  }

  async sendWhatsApp(_opts: WhatsAppOpts): Promise<void> {
    throw new Error("Resend does not support WhatsApp. Use NOTIFICATION_PROVIDER=twilio instead.");
  }
}
