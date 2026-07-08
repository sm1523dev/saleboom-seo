"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { LinkOpportunity } from "@/app/actions/internal-links.actions";
import { cn } from "@/lib/utils";

type Props = {
  opportunities: LinkOpportunity[];
};

export function InternalLinksView({ opportunities }: Props) {
  const [query, setQuery] = useState("");

  const filtered =
    query.trim() === ""
      ? opportunities
      : opportunities.filter((opp) => {
          const q = query.toLowerCase();
          return (
            opp.sourceUrl.toLowerCase().includes(q) ||
            opp.targetUrl.toLowerCase().includes(q) ||
            (opp.sourceTitle?.toLowerCase().includes(q) ?? false) ||
            (opp.targetTitle?.toLowerCase().includes(q) ?? false)
          );
        });

  if (opportunities.length === 0) {
    return (
      <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium">No internal linking opportunities found.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your site is well-connected!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Filter by URL or title…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-[border-color,box-shadow]"
      />

      <AnimatePresence initial={false} mode="popLayout">
        {filtered.length === 0 ? (
          <motion.p
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-6 text-center text-sm text-muted-foreground"
          >
            No opportunities match your search.
          </motion.p>
        ) : (
          filtered.map((opp) => (
            <motion.div
              key={`${opp.sourceUrl}→${opp.targetUrl}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            >
              <OpportunityCard opp={opp} />
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}

function OpportunityCard({ opp }: { opp: LinkOpportunity }) {
  const scorePercent = Math.round(opp.score * 100);

  return (
    <div className="card-glow rounded-xl border border-border bg-card p-4">
      {/* Pages row */}
      <div className="flex flex-wrap items-start gap-2">
        {/* Source */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">
            {opp.sourceTitle ?? "Untitled page"}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {opp.sourceUrl}
          </p>
        </div>

        {/* Arrow */}
        <span
          className="mt-0.5 shrink-0 text-sm font-bold text-primary"
          aria-label="links to"
        >
          →
        </span>

        {/* Target */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-snug">
            {opp.targetTitle ?? "Untitled page"}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {opp.targetUrl}
          </p>
        </div>
      </div>

      {/* Shared keywords */}
      {opp.sharedKeywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {opp.sharedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {/* Score bar */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Relevance</span>
          <span
            className={cn(
              "font-mono text-xs font-medium",
              scorePercent >= 60
                ? "text-green-400"
                : scorePercent >= 30
                  ? "text-yellow-400"
                  : "text-muted-foreground",
            )}
          >
            {scorePercent}%
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted/30">
          <div
            className="h-1 rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${scorePercent}%` }}
            role="progressbar"
            aria-valuenow={scorePercent}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>
    </div>
  );
}
