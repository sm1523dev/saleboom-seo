import type { Metadata } from "next";
import { SignUpCard } from "./_components/sign-up-card";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create your SaleBoom SEO account and start optimising your website.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <SignUpCard />;
}
