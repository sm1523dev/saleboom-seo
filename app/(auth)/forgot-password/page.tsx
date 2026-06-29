import type { Metadata } from "next";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot Password — SaleBoom SEO",
  description: "Reset your SaleBoom SEO account password.",
  robots: { index: false, follow: false },
  openGraph: { title: "Forgot Password — SaleBoom SEO", description: "Reset your password." },
  twitter: { card: "summary" },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
