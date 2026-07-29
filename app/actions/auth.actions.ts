"use server";

import { authProvider } from "@/lib/auth";

export async function signOutAction(): Promise<void> {
  await authProvider.signOut({ redirectTo: "/sign-in" });
}
