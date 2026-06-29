import type { Metadata } from "next";
import { authProvider } from "@/lib/auth";
import { SignInCard } from "./_components/sign-in-card";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your SaleBoom SEO account to access your dashboard.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  // Filter out credentials — it's rendered as the email/password form, not a social button
  const socialProviders = authProvider
    .getAvailableProviders()
    .filter((p) => p !== "credentials" && p !== "mock");

  return <SignInCard socialProviders={socialProviders} />;
}
