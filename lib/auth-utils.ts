import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";

export async function getServerSession(): Promise<Session> {
  const session = await auth();
  if (!session) redirect("/sign-in");
  return session;
}
