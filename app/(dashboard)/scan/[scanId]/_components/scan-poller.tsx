"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

type Props = {
  scanId: string;
  initialStatus: string;
  websiteId: string;
  initialPagesScanned?: number;
  initialTotalPages?: number;
};

const POLL_INTERVAL = 3000;

export function ScanPoller({
  scanId,
  initialStatus,
  websiteId,
  initialPagesScanned = 0,
  initialTotalPages = 0,
}: Props) {
  const router = useRouter();
  const statusRef = useRef(initialStatus);
  const [pagesScanned, setPagesScanned] = useState(initialPagesScanned);
  const [totalPages, setTotalPages] = useState(initialTotalPages);

  useEffect(() => {
    if (statusRef.current === "completed" || statusRef.current === "failed") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/scan/${scanId}/status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        statusRef.current = data.status;

        if (data.pagesScanned > 0) setPagesScanned(data.pagesScanned);
        if (data.totalPages > 0) setTotalPages(data.totalPages);

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
  }, [scanId, router, websiteId]);

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

      {/* Live page counter */}
      {totalPages > 0 ? (
        <p className="font-mono text-sm font-medium text-primary">
          {pagesScanned} / {totalPages} pages scanned
        </p>
      ) : pagesScanned > 0 ? (
        <p className="font-mono text-sm font-medium text-primary">
          {pagesScanned} pages scanned…
        </p>
      ) : null}

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
