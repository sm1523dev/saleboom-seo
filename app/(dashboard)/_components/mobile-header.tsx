"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { NavContent, type SidebarProps } from "./sidebar-nav";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export function MobileHeader(props: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      {/* Sticky top bar — visible only below md */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <span className="text-sm font-semibold">
          <span className="text-gradient">SaleBoom</span>{" "}
          <span className="text-muted-foreground">SEO</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
          aria-label="Open navigation menu"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 4.5h12M3 9h12M3 13.5h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* Sheet drawer — slides from left */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="flex w-72 flex-col bg-card p-0"
        >
          <VisuallyHidden>
            <SheetTitle>Navigation</SheetTitle>
          </VisuallyHidden>

          {/* Logo inside sheet */}
          <div className="flex h-14 items-center border-b border-border px-4">
            <span className="text-sm font-semibold">
              <span className="text-gradient">SaleBoom</span>{" "}
              <span className="text-muted-foreground">SEO</span>
            </span>
          </div>

          <NavContent {...props} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
