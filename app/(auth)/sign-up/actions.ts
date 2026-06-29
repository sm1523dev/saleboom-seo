"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { parseEmail, parseRequiredString } from "@/lib/form-validation";

export async function signUpWithCredentials(formData: FormData) {
  const email = parseEmail(formData.get("email"));
  const password = parseRequiredString(formData.get("password"), "Password");
  const name = formData.get("name");
  const nameStr = typeof name === "string" ? name.trim() || null : null;

  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) throw new Error("An account with this email already exists.");

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ email, name: nameStr, passwordHash });

  await authProvider.signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard",
  } as Parameters<typeof authProvider.signIn>[1]);
}
