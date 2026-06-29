"use server";

import { authProvider } from "@/lib/auth";

export async function signInWithCredentials(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  await authProvider.signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  } as Parameters<typeof authProvider.signIn>[1]);
}

export async function signInWithProvider(provider: string) {
  await authProvider.signIn(provider, { redirectTo: "/dashboard" });
}
