import { authProvider } from "@/lib/auth";
import type { AuthSession } from "@/lib/auth";

export async function getServerSession(): Promise<AuthSession> {
  return authProvider.requireSession();
}
