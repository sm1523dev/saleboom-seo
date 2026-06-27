import type { Metadata } from "next";
import { SignInCard } from "./_components/sign-in-card";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your SaleBoom SEO account to access your dashboard.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <SignInCard />;
}
