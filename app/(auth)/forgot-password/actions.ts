"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createResetToken } from "@/lib/auth/reset-token";
import { notificationProvider } from "@/lib/notifications";
import { parseEmail } from "@/lib/form-validation";

export async function requestPasswordReset(formData: FormData) {
  const email = parseEmail(formData.get("email"));

  // Always silently succeed — never reveal whether the email exists (prevents user enumeration)
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return;

  const token = createResetToken(user.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await notificationProvider.sendEmail({
    to: email,
    subject: "Reset your SaleBoom SEO password",
    html: `
      <p>You requested a password reset for your SaleBoom SEO account.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
    `,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
}
