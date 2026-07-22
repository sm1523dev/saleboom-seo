"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export type SignUpState = { error?: string } | null;

export async function signUpWithCredentials(
  _prev: SignUpState,
  formData: FormData,
): Promise<SignUpState> {
  try {
    const email = parseEmail(formData.get("email"));
    const password = parseRequiredString(formData.get("password"), "Password");
    const name = formData.get("name");
    const nameStr = typeof name === "string" ? name.trim() || null : null;

    if (password.length < 8) return { error: "Password must be at least 8 characters." };

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) return { error: "An account with this email already exists." };

    const passwordHash = await hashPassword(password);
    try {
      await db.insert(users).values({ email, name: nameStr, passwordHash });
    } catch {
      return { error: "Failed to create account. Please try again." };
    }

    const raw = formData.get("callbackUrl");
    const redirectTo = typeof raw === "string" && raw.startsWith("/") ? raw : "/dashboard";

    await authProvider.signIn("credentials", {
      email,
      password,
      redirectTo,
    } as Parameters<typeof authProvider.signIn>[1]);

    return null;
  } catch (err) {
    // Next.js redirect throws a special object — let it propagate
    const e = err as { digest?: string };
    if (e?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    return { error: String(err) };
  }
}
