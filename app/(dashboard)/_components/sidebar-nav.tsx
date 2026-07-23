"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "◎" },
  { href: "/scan", label: "New Scan", icon: "⊙" },
  { href: "/aeo", label: "AEO", icon: "⊛" },
  { href: "/alerts", label: "Alerts", icon: "⊘" },
  { href: "/changes", label: "CMS Queue", icon: "⊡" },
  { href: "/changes/history", label: "History", icon: "⊟" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/stats", label: "System Stats", icon: "⊞" },
  { href: "/admin/users", label: "Users", icon: "⊕" },
  { href: "/admin/providers", label: "Providers", icon: "⊗" },
  { href: "/admin/requests", label: "Requests", icon: "⊜" },
  { href: "/admin/history", label: "Change History", icon: "⊝" },
] as const;

export type SidebarProps = {
  userName: string | null;
  userEmail: string;
  isAdmin?: boolean;
  unreadAlerts?: number;
  pendingRequests?: number;
};

const WEBSITE_NAV_ITEMS = [
  { slug: "", label: "Overview", icon: "⊟" },
  { slug: "cms", label: "CMS Settings", icon: "⊡" },
  { slug: "sitemap", label: "Sitemap", icon: "⊞" },
  { slug: "competitors", label: "Competitors", icon: "⊗" },
] as const;

export function NavContent({
  userName,
  userEmail,
  isAdmin,
  unreadAlerts = 0,
  pendingRequests = 0,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  // Extract websiteId when navigating within /website/{id}/*
  const websiteMatch = pathname.match(/^\/website\/([^/]+)/);
  const activeWebsiteId = websiteMatch?.[1] ?? null;

  return (
    <>
      {/* Nav */}
      <nav className="flex-1 p-2" aria-label="Main navigation">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
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
                  {item.href === "/alerts" && unreadAlerts > 0 && (
                    <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {activeWebsiteId && (
          <div className="mt-4">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Website
            </p>
            <ul className="space-y-0.5" role="list">
              {WEBSITE_NAV_ITEMS.map((item) => {
                const href = `/website/${activeWebsiteId}${item.slug ? `/${item.slug}` : ""}`;
                const isActive = item.slug === ""
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={item.slug}>
                    <Link
                      href={href}
                      onClick={onNavigate}
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
                          isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"
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
          </div>
        )}

        {isAdmin && (
          <div className="mt-4">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Admin
            </p>
            <ul className="space-y-0.5" role="list">
              {ADMIN_NAV_ITEMS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
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
                      {item.href === "/admin/requests" && pendingRequests > 0 && (
                        <span className="ml-auto rounded-full bg-yellow-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-yellow-400">
                          {pendingRequests}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3 space-y-1">
        <Link
          href="/profile"
          onClick={onNavigate}
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

        <form method="POST" action="/api/sign-out">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <span aria-hidden="true" className="font-mono text-base">⊘</span>
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

export function SidebarNav(props: SidebarProps) {
  return (
    <aside
      className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card"
      aria-label="Dashboard navigation"
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold">
          <span className="text-gradient">SaleBoom</span>{" "}
          <span className="text-muted-foreground">SEO</span>
        </span>
      </div>

      <NavContent {...props} />
    </aside>
  );
}
