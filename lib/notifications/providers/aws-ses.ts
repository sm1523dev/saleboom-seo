import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class AwsSesNotificationProvider implements NotificationProvider {
  constructor() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error("AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for NOTIFICATION_PROVIDER=ses");
    }
  }

  async sendEmail(opts: EmailOpts): Promise<void> {
    const { SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2");

    const client = new SESv2Client({ region: process.env.AWS_REGION ?? "us-east-1" });
    const defaultFrom = process.env.SES_FROM ?? "noreply@saleboom.com";
    const toList = typeof opts.to === "string" ? [opts.to] : opts.to;

    await client.send(
      new SendEmailCommand({
        FromEmailAddress: opts.from ?? defaultFrom,
        Destination: { ToAddresses: toList },
        Content: {
          Simple: {
            Subject: { Data: opts.subject },
            Body: {
              Html: { Data: opts.html },
              ...(opts.text ? { Text: { Data: opts.text } } : {}),
            },
          },
        },
      })
    );
  }

  async sendWhatsApp(_opts: WhatsAppOpts): Promise<void> {
    throw new Error("AWS SES does not support WhatsApp. Use NOTIFICATION_PROVIDER=twilio instead.");
  }
}
