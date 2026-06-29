import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class TwilioNotificationProvider implements NotificationProvider {
  private readonly accountSid: string;
  private readonly authToken: string;
  private readonly whatsappFrom: string;
  private readonly defaultEmailFrom: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
    this.whatsappFrom = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";
    this.defaultEmailFrom = process.env.TWILIO_EMAIL_FROM ?? "noreply@saleboom.com";

    if (!this.accountSid || !this.authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for NOTIFICATION_PROVIDER=twilio");
    }
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    const sgMail = require("@sendgrid/mail");
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error("SENDGRID_API_KEY is required for Twilio email sending");

    sgMail.setApiKey(apiKey);
    await sgMail.send({
      from: opts.from ?? this.defaultEmailFrom,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
  }

  async sendWhatsApp(opts: WhatsAppOpts): Promise<void> {
    const twilio = require("twilio");
    const client = twilio(this.accountSid, this.authToken);

    await client.messages.create({
      from: this.whatsappFrom,
      to: `whatsapp:${opts.to}`,
      body: opts.message,
      ...(opts.mediaUrl ? { mediaUrl: [opts.mediaUrl] } : {}),
    });
  }
}
