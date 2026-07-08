import type { Metadata } from "next";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAlerts, users } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { SidebarNav } from "./_components/sidebar-nav";

export const metadata: Metadata = {
  title: { template: "%s | Dashboard", default: "Dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();

  const [[user], [alertRow]] = await Promise.all([
    db
      .select({ name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
    db
      .select({ count: count() })
      .from(userAlerts)
      .where(and(eq(userAlerts.userId, session.user.id), isNull(userAlerts.readAt))),
  ]);

  const unreadAlerts = Number(alertRow?.count ?? 0);

  return (
    <div className="flex min-h-screen">
      <SidebarNav
        userName={user?.name ?? null}
        userEmail={user?.email ?? session.user.email}
        isAdmin={session.user.role === "admin"}
        unreadAlerts={unreadAlerts}
      />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
