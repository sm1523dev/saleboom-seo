"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export type ProfileActionState = { error?: string; success?: string } | null;

export async function updateNameAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getServerSession();
  const name = formData.get("name");
  const nameStr = typeof name === "string" ? name.trim() || null : null;

  await db
    .update(users)
    .set({ name: nameStr, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { success: "Name updated." };
}

export async function updateEmailAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getServerSession();

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.passwordHash) return { error: "Email cannot be changed for social accounts." };

  const newEmail = parseEmail(formData.get("email"));
  const currentPassword = parseRequiredString(formData.get("currentPassword"), "Current password");

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);

  if (existing && existing.id !== session.user.id) {
    return { error: "An account with this email already exists." };
  }

  await db
    .update(users)
    .set({ email: newEmail, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { success: "Email updated. Sign in again to refresh your session." };
}

export async function updatePasswordAction(
  _prev: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const session = await getServerSession();

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  if (!user?.passwordHash) return { error: "Password cannot be changed for social accounts." };

  const currentPassword = parseRequiredString(formData.get("currentPassword"), "Current password");
  const newPassword = parseRequiredString(formData.get("newPassword"), "New password");

  if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  revalidatePath("/profile");
  return { success: "Password updated." };
}

export async function signOutAction() {
  // JWT sessions: deleting the session cookie is sufficient to sign out.
  // Bypassing authProvider.signOut() avoids redirect chaining issues under
  // Azure's Envoy proxy where res.redirect can be undefined.
  const cookieJar = await cookies();
  const cookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "authjs.callback-url",
    "__Secure-authjs.callback-url",
    "authjs.csrf-token",
    "__Host-authjs.csrf-token",
  ];
  for (const name of cookieNames) cookieJar.delete(name);
  redirect("/");
}
