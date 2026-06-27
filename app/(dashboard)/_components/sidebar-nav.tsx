"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "◎" },
  { href: "/dashboard/audit", label: "SEO Audit", icon: "⊙" },
  { href: "/dashboard/aeo", label: "AEO Intelligence", icon: "◈" },
  { href: "/dashboard/cms", label: "CMS Push", icon: "⊛" },
  { href: "/dashboard/reports", label: "Reports", icon: "⊞" },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r border-border bg-card"
      aria-label="Dashboard navigation"
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold">
          <span className="text-gradient">SaleBoom</span>{" "}
          <span className="text-muted-foreground">SEO</span>
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm",
                    "border-l-2 transition-colors duration-150",
                    isActive
                      ? "border-primary bg-accent text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "font-mono text-base transition-colors duration-150",
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-primary"
                    )}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground">SaleBoom SEO v0.1</p>
      </div>
    </aside>
  );
}
