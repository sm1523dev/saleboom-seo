import type { Metadata } from "next";
import { authProvider } from "@/lib/auth";
import { SignInCard } from "./_components/sign-in-card";

export const metadata: Metadata = {
  title: "Sign In — SaleBoom SEO",
  description: "Sign in to your SaleBoom SEO account to access your dashboard.",
  robots: { index: false, follow: false },
  openGraph: { title: "Sign In — SaleBoom SEO", description: "Sign in to your account." },
  twitter: { card: "summary" },
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const socialProviders = authProvider
    .getAvailableProviders()
    .filter((p) => p !== "credentials" && p !== "mock");

  return <SignInCard socialProviders={socialProviders} callbackUrl={callbackUrl} />;
}
