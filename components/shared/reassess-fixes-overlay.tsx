"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";

type Phase = "validating" | "reassessing" | "done";

type Props = {
  /** When true, cycles validating → reassessing messages */
  active: boolean;
  /** Override phase (e.g. results page only shows reassessing) */
  phase?: Phase;
  /** Optional success line after done */
  successMessage?: string | null;
};

export function ReassessFixesOverlay({ active, phase: forcedPhase, successMessage }: Props) {
  const [autoPhase, setAutoPhase] = useState<Phase>("validating");

  useEffect(() => {
    if (!active || forcedPhase) return;
    setAutoPhase("validating");
    const t = setTimeout(() => setAutoPhase("reassessing"), 800);
    return () => clearTimeout(t);
  }, [active, forcedPhase]);

  if (!active && !successMessage) return null;

  const phase = forcedPhase ?? autoPhase;
  const title =
    successMessage
      ? successMessage
      : phase === "validating"
        ? "Validating connection…"
        : "Reassessing all fixes…";
  const subtitle =
    successMessage
      ? "Updating your scan results"
      : phase === "validating"
        ? "Checking credentials and CMS access"
        : "Checking which issues can be applied automatically";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="status"
      aria-live="polite"
      aria-busy={!successMessage}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl"
      >
        {!successMessage && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary"
            aria-hidden="true"
          />
        )}
        {successMessage && (
          <span className="mx-auto mb-4 inline-block h-2.5 w-2.5 rounded-full bg-green-400" aria-hidden="true" />
        )}
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </motion.div>
    </div>
  );
}
