import type { NotificationProvider, EmailOpts, WhatsAppOpts } from "../types";

export class MockNotificationProvider implements NotificationProvider {
  async sendEmail(opts: EmailOpts): Promise<void> {
    console.log("[notifications:mock] sendEmail →", {
      to: opts.to,
      subject: opts.subject,
    });
    console.log("[notifications:mock] html preview →\n", opts.html);
  }

  async sendWhatsApp(opts: WhatsAppOpts): Promise<void> {
    console.log("[notifications:mock] sendWhatsApp →", {
      to: opts.to,
      message: opts.message,
    });
  }
}
