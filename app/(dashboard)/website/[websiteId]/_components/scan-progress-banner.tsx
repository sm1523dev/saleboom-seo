"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 4000;

export function ScanProgressBanner({ scanId }: { scanId: string }) {
  const router = useRouter();

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const { status } = await res.json();
        if (status === "completed" || status === "failed") {
          router.refresh();
        }
      } catch {
        // network hiccup — next tick retries
      }
    };

    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [scanId, router]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
    >
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
      </span>
      <p className="text-sm text-muted-foreground">
        Scan in progress — overview will update automatically when complete.
      </p>
    </div>
  );
}
