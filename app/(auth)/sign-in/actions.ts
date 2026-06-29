"use server";

import { authProvider } from "@/lib/auth";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export async function signInWithCredentials(formData: FormData) {
  const email = parseEmail(formData.get("email"));
  const password = parseRequiredString(formData.get("password"), "Password");

  await authProvider.signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  } as Parameters<typeof authProvider.signIn>[1]);
}

export async function signInWithProvider(provider: string) {
  await authProvider.signIn(provider, { redirectTo: "/dashboard" });
}
