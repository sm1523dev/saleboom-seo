"use server";

import { signIn } from "@/lib/auth";

export async function signInWithMicrosoft() {
  await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
}
