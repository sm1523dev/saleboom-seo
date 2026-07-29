import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class SmtpNotificationProvider implements NotificationProvider {
  private readonly host: string;
  private readonly port: number;
  private readonly user: string;
  private readonly pass: string;
  private readonly defaultFrom: string;

  constructor(apiKey?: string, config?: Record<string, string>) {
    this.user = apiKey ?? process.env.SMTP_USER ?? "";
    this.pass = config?.pass ?? process.env.SMTP_PASS ?? "";
    this.host = config?.host ?? process.env.SMTP_HOST ?? "smtp.gmail.com";
    this.port = Number(config?.port ?? process.env.SMTP_PORT ?? "587");
    this.defaultFrom = config?.from ?? process.env.SMTP_FROM ?? this.user;

    if (!this.user || !this.pass) {
      throw new Error("SMTP_USER and SMTP_PASS are required for NOTIFICATION_PROVIDER=smtp");
    }
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    const nodemailer = require("nodemailer") as typeof import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.port === 465,
      auth: { user: this.user, pass: this.pass },
    });

    await transporter.sendMail({
      from: opts.from ?? this.defaultFrom,
      to: typeof opts.to === "string" ? opts.to : opts.to.join(", "),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });
  }

  async sendWhatsApp(_opts: WhatsAppOpts): Promise<void> {
    throw new Error("SMTP does not support WhatsApp. Use NOTIFICATION_PROVIDER=twilio instead.");
  }
}
