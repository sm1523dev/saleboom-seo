import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "./_components/reset-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password for your SaleBoom SEO account.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) redirect("/forgot-password");
  return <ResetPasswordForm token={token} />;
}
