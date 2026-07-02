"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/(dashboard)/profile/actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "◎" },
  { href: "/scan", label: "New Scan", icon: "⊙" },
  { href: "/aeo", label: "AEO", icon: "⊛" },
  { href: "/dashboard/reports", label: "Reports", icon: "⊞" },
] as const;

type Props = {
  userName: string | null;
  userEmail: string;
};

export function SidebarNav({ userName, userEmail }: Props) {
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

      {/* User footer */}
      <div className="border-t border-border p-3 space-y-1">
        <Link
          href="/profile"
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
            "border-l-2",
            pathname === "/profile"
              ? "border-primary bg-accent text-foreground"
              : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
          aria-current={pathname === "/profile" ? "page" : undefined}
        >
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs text-primary"
          >
            {(userName ?? userEmail).charAt(0).toUpperCase()}
          </span>
          <span className="flex flex-col overflow-hidden">
            <span className="truncate text-xs font-medium leading-tight text-foreground">
              {userName ?? "Account"}
            </span>
            <span className="truncate text-[11px] leading-tight text-muted-foreground">
              {userEmail}
            </span>
          </span>
        </Link>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <span aria-hidden="true" className="font-mono text-base">⊘</span>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
