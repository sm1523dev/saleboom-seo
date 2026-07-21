"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  setPlatformHint,
  confirmPlatform,
  rejectDetectedPlatform,
  requestPlatformAssistance,
} from "@/app/actions/platform.actions";
import type { Platform } from "@/lib/platform-detect";
import { PLATFORM_LABELS } from "@/lib/platform-detect";

type PlatformHintStatus = "unconfirmed" | "confirmed" | "pending_assistance";

type Props = {
  websiteId: string;
  detectedPlatform: Platform | null;
  platformHintStatus: PlatformHintStatus;
};

const ALL_PLATFORMS: Platform[] = ["wordpress", "shopify", "webflow", "github", "unknown"];

const PLATFORM_DESCRIPTIONS: Record<Platform, string> = {
  wordpress: "Self-hosted or WordPress.com",
  shopify: "Shopify-powered store",
  webflow: "Built with Webflow",
  github: "Custom code, managed by a developer",
  unknown: "I'll find out later",
};

export function PlatformCards({ websiteId, detectedPlatform, platformHintStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [phase, setPhase] = useState<"confirm" | "pick" | "done" | "assistance">(
    detectedPlatform && platformHintStatus === "unconfirmed" ? "confirm" : "pick"
  );
  const [assistanceSent, setAssistanceSent] = useState(platformHintStatus === "pending_assistance");

  if (assistanceSent) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-6 text-center"
      >
        <p className="text-sm font-medium">✓ Request sent</p>
        <p className="mt-1 text-xs text-muted-foreground">
          We'll verify your platform and help you push your first fix correctly.
          Expect to hear from us within 24 hours.
        </p>
        <button
          className="mt-4 text-xs text-primary underline-offset-4 hover:underline"
          onClick={() => { setAssistanceSent(false); setPhase("pick"); }}
        >
          I know it now — set it up myself →
        </button>
      </motion.div>
    );
  }

  if (phase === "confirm" && detectedPlatform) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          We think this site runs on{" "}
          <span className="font-medium text-foreground">{PLATFORM_LABELS[detectedPlatform]}</span> — confirm?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(["yes", "no", "unsure"] as const).map((opt, i) => (
            <motion.button
              key={opt}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              disabled={isPending}
              onClick={() => {
                if (opt === "yes") {
                  startTransition(async () => {
                    await confirmPlatform(websiteId, detectedPlatform);
                    setPhase("done");
                  });
                } else if (opt === "no") {
                  startTransition(async () => {
                    await rejectDetectedPlatform(websiteId);
                    setPhase("pick");
                  });
                } else {
                  startTransition(async () => {
                    await requestPlatformAssistance(websiteId);
                    setAssistanceSent(true);
                  });
                }
              }}
              className={[
                "flex flex-col items-center gap-1.5 rounded-xl border p-4 text-sm font-medium transition-colors",
                "hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50",
                opt === "yes" ? "border-green-500/30 bg-green-500/5 text-green-400 hover:border-green-500/60 hover:bg-green-500/10" :
                opt === "no" ? "border-red-500/30 bg-red-500/5 text-red-400 hover:border-red-500/60 hover:bg-red-500/10" :
                "border-border text-muted-foreground",
              ].join(" ")}
            >
              <span className="text-xl">{opt === "yes" ? "✓" : opt === "no" ? "✗" : "?"}</span>
              <span>{opt === "yes" ? "Yes, correct" : opt === "no" ? "No, change it" : "Not sure"}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  if (phase === "done") {
    return (
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-xs text-muted-foreground"
      >
        ✓ Platform saved
      </motion.p>
    );
  }

  // pick phase — show all 5 platform cards
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <p className="text-sm text-muted-foreground">
        While we scan — what platform is your site on?
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ALL_PLATFORMS.map((platform, i) => (
          <motion.button
            key={platform}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            disabled={isPending}
            onClick={() => {
              if (platform === "unknown") {
                startTransition(async () => {
                  await requestPlatformAssistance(websiteId);
                  setAssistanceSent(true);
                });
              } else {
                startTransition(async () => {
                  await setPlatformHint(websiteId, platform);
                  setPhase("done");
                });
              }
            }}
            className={[
              "flex flex-col items-start gap-1 rounded-xl border border-border bg-muted/30 p-4 text-left transition-colors",
              "hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50",
            ].join(" ")}
          >
            <span className="text-sm font-medium">{PLATFORM_LABELS[platform]}</span>
            <span className="text-xs text-muted-foreground">{PLATFORM_DESCRIPTIONS[platform]}</span>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
