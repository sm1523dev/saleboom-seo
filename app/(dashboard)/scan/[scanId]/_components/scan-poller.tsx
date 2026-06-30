"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

type Props = {
  scanId: string;
  initialStatus: string;
  websiteId: string;
};

const POLL_INTERVAL = 3000;

export function ScanPoller({ scanId, initialStatus, websiteId }: Props) {
  const router = useRouter();
  const statusRef = useRef(initialStatus);

  useEffect(() => {
    if (statusRef.current === "completed" || statusRef.current === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        statusRef.current = data.status;

        if (data.status === "completed") {
          router.push(`/website/${websiteId}`);
        } else if (data.status === "failed") {
          router.refresh();
        }
      } catch {
        // network hiccup — next tick will retry
      }
    };

    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [scanId, router]);

  const isActive = initialStatus === "pending" || initialStatus === "running";
  if (!isActive) return null;

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      {/* Animated scan ring */}
      <div className="relative flex h-10 w-10 items-center justify-center">
        <motion.span
          className="absolute inline-flex h-full w-full rounded-full bg-primary/30"
          animate={{ scale: [1, 1.6, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-primary" />
      </div>

      {/* Skeleton bars */}
      <div className="mt-2 w-full max-w-xs space-y-2">
        {[80, 60, 72].map((w, i) => (
          <motion.div
            key={i}
            className="h-2 rounded-full bg-muted"
            style={{ width: `${w}%` }}
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Checking for updates every 3 seconds…
      </p>
    </div>
  );
}
