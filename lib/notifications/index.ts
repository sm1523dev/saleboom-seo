import type { NotificationProvider } from "./types";

function createProvider(): NotificationProvider {
  const name = process.env.NOTIFICATION_PROVIDER ?? "mock";

  switch (name) {
    case "resend":
      return new (require("./providers/resend").ResendNotificationProvider)();
    case "sendgrid":
      return new (require(/* webpackIgnore: true */ "./providers/sendgrid").SendGridNotificationProvider)();
    case "twilio":
      return new (require(/* webpackIgnore: true */ "./providers/twilio").TwilioNotificationProvider)();
    case "ses":
      return new (require(/* webpackIgnore: true */ "./providers/aws-ses").AwsSesNotificationProvider)();
    case "mock":
      return new (require("./providers/mock").MockNotificationProvider)();
    default:
      throw new Error(
        `Unknown NOTIFICATION_PROVIDER: "${name}". Valid: resend, sendgrid, twilio, ses, mock`
      );
  }
}

export const notificationProvider: NotificationProvider = createProvider();
export type { NotificationProvider, EmailOpts, WhatsAppOpts } from "./types";
