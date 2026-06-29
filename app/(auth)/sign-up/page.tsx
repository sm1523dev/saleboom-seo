import type { Metadata } from "next";
import { SignUpCard } from "./_components/sign-up-card";

export const metadata: Metadata = {
  title: "Create Account — SaleBoom SEO",
  description: "Create your SaleBoom SEO account and start optimising your website.",
  robots: { index: false, follow: false },
  openGraph: { title: "Create Account — SaleBoom SEO", description: "Sign up for SaleBoom SEO." },
  twitter: { card: "summary" },
};

export default function SignUpPage() {
  return <SignUpCard />;
}
