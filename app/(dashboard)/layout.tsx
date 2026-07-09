import type { Metadata } from "next";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAlerts, users, providerRequests } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { SidebarNav } from "./_components/sidebar-nav";
import { MobileHeader } from "./_components/mobile-header";

export const metadata: Metadata = {
  title: { template: "%s | Dashboard", default: "Dashboard" },
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  const isAdmin = session.user.role === "admin";

  const queries: Promise<unknown>[] = [
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, session.user.id)).limit(1),
    db.select({ count: count() }).from(userAlerts).where(and(eq(userAlerts.userId, session.user.id), isNull(userAlerts.readAt))),
  ];

  if (isAdmin) {
    queries.push(
      db.select({ count: count() }).from(providerRequests).where(and(eq(providerRequests.status, "pending"), isNull(providerRequests.deletedAt))),
    );
  }

  const results = await Promise.all(queries);
  const [[user], [alertRow], pendingRow] = results as [
    [{ name: string; email: string }],
    [{ count: number }],
    [{ count: number }] | undefined,
  ];

  const unreadAlerts = Number(alertRow?.count ?? 0);
  const pendingRequests = isAdmin ? Number((pendingRow as [{ count: number }])?.[0]?.count ?? 0) : 0;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <SidebarNav
        userName={user?.name ?? null}
        userEmail={user?.email ?? session.user.email}
        isAdmin={isAdmin}
        unreadAlerts={unreadAlerts}
        pendingRequests={pendingRequests}
      />
      <div className="flex flex-1 flex-col overflow-auto">
        <MobileHeader
          userName={user?.name ?? null}
          userEmail={user?.email ?? session.user.email}
          isAdmin={isAdmin}
          unreadAlerts={unreadAlerts}
          pendingRequests={pendingRequests}
        />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
