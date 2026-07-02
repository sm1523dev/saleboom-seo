import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { SidebarNav } from "./_components/sidebar-nav";

export const metadata: Metadata = {
  title: { template: "%s | Dashboard", default: "Dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        userName={user?.name ?? null}
        userEmail={user?.email ?? session.user.email}
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
