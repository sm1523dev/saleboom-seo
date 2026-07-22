"use server";

import { AuthError } from "next-auth";
import { authProvider } from "@/lib/auth";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export type SignInState = { error?: string } | null;

export async function signInWithCredentials(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  try {
    const email = parseEmail(formData.get("email"));
    const password = parseRequiredString(formData.get("password"), "Password");
    const raw = formData.get("callbackUrl");
    const redirectTo = typeof raw === "string" && raw.startsWith("/") ? raw : "/dashboard";

    await authProvider.signIn("credentials", {
      email,
      password,
      redirectTo,
    } as Parameters<typeof authProvider.signIn>[1]);

    return null;
  } catch (err) {
    // Let Next.js redirects through (successful sign-in navigates away)
    const e = err as { digest?: string };
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    if (err instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    // Any other error (JWT callback failure, DB error, config issue)
    return { error: "Sign in failed. Please try again." };
  }
}

export async function signInWithProvider(provider: string, callbackUrl?: string) {
  const redirectTo = typeof callbackUrl === "string" && callbackUrl.startsWith("/")
    ? callbackUrl
    : "/dashboard";
  await authProvider.signIn(provider, { redirectTo });
}
