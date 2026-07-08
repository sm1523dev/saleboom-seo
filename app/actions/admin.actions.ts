"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

export async function promoteToAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to promote user" };
  }
}

export async function demoteFromAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    if (session.user.id === userId) return { success: false, error: "Cannot demote yourself" };
    await db.update(users).set({ role: "user", updatedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to demote user" };
  }
}

export async function deactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireAdmin();
    if (session.user.id === userId) return { success: false, error: "Cannot deactivate yourself" };
    await db.update(users).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to deactivate user" };
  }
}

export async function reactivateUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await db.update(users).set({ deletedAt: null, updatedAt: new Date() }).where(eq(users.id, userId));
    revalidatePath("/admin/users");
    return { success: true };
  } catch {
    return { success: false, error: "Failed to reactivate user" };
  }
}
