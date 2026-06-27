import type { Metadata } from "next";
import { SidebarNav } from "./_components/sidebar-nav";

// Dashboard pages should not be indexed by search engines.
export const metadata: Metadata = {
  title: { template: "%s | Dashboard", default: "Dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
