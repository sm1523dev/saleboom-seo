import { sendAdminAlert } from "@/lib/notifications/send";

export async function notifyAlert(message: string): Promise<void> {
  const html = `<p>${message.replace(/\n/g, "<br>")}</p>`;
  await sendAdminAlert({
    text: `🚨 *SaleBoom SEO Alert*\n${message}`,
    subject: "SaleBoom SEO Alert",
    html,
  });
}
