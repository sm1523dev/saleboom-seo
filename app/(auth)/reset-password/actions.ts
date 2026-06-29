"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { verifyResetToken } from "@/lib/auth/reset-token";
import { hashPassword } from "@/lib/auth/providers/authjs";

export async function resetPassword(formData: FormData) {
  const token = formData.get("token") as string;
  const password = formData.get("password") as string;

  if (!token || !password) throw new Error("Invalid request.");
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const result = verifyResetToken(token);
  if (!result.ok) {
    if (result.reason === "expired") throw new Error("This reset link has expired. Please request a new one.");
    throw new Error("Invalid reset link.");
  }

  const passwordHash = await hashPassword(password);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, result.userId));

  redirect("/sign-in?reset=success");
}
