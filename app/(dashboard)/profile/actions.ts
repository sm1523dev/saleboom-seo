"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
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
  await authProvider.signOut({ redirectTo: "/" });
}
