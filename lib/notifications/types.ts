export type EmailOpts = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export type WhatsAppOpts = {
  to: string;
  message: string;
  mediaUrl?: string;
};

export interface NotificationProvider {
  sendEmail(opts: EmailOpts): Promise<void>;
  sendWhatsApp(opts: WhatsAppOpts): Promise<void>;
}
