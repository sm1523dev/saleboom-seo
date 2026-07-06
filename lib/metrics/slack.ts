export async function sendSlackAlert(message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_ALERT_WEBHOOK;
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: `🚨 *SaleBoom SEO Alert*\n${message}` }),
  }).catch(() => {});
}
