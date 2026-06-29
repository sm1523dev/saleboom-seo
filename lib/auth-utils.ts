import { redirect } from "next/navigation";
import { authProvider } from "@/lib/auth";
import type { AuthSession } from "@/lib/auth";

export async function getServerSession(): Promise<AuthSession> {
  const session = await authProvider.getSession();
  if (!session) redirect("/sign-in");
  return session;
}
