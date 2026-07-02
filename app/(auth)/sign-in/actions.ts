"use server";

import { authProvider } from "@/lib/auth";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export async function signInWithCredentials(formData: FormData) {
  const email = parseEmail(formData.get("email"));
  const password = parseRequiredString(formData.get("password"), "Password");
  const raw = formData.get("callbackUrl");
  const redirectTo = typeof raw === "string" && raw.startsWith("/") ? raw : "/dashboard";

  await authProvider.signIn("credentials", {
    email,
    password,
    redirectTo,
  } as Parameters<typeof authProvider.signIn>[1]);
}

export async function signInWithProvider(provider: string, callbackUrl?: string) {
  const redirectTo = typeof callbackUrl === "string" && callbackUrl.startsWith("/")
    ? callbackUrl
    : "/dashboard";
  await authProvider.signIn(provider, { redirectTo });
}
