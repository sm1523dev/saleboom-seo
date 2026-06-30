"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { scoreColorClass, scoreGrade } from "@/lib/seo-score";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type FixType = "quick" | "major" | null;

type Issue = {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string | null;
  fixType: FixType;
};

type Props = {
  scanId: string;
  websiteName: string;
  websiteUrl: string;
  completedAt: string | null;
  score: number;
  fixCounts: { quick: number; major: number };
  issues: Issue[];
};

const SEVERITY_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; className: string; dotClass: string }
> = {
  critical: {
    label: "Critical",
    className: "border-red-500/30 bg-red-500/10 text-red-400",
    dotClass: "bg-red-400",
  },
  high: {
    label: "High",
    className: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    dotClass: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    dotClass: "bg-yellow-400",
  },
  low: {
    label: "Low",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    dotClass: "bg-blue-400",
  },
  info: {
    label: "Info",
    className: "border-border bg-muted text-muted-foreground",
    dotClass: "bg-muted-foreground",
  },
};


export function ResultsView({
  scanId,
  websiteName,
  websiteUrl,
  completedAt,
  score,
  fixCounts,
  issues,
}: Props) {
  const [filter, setFilter] = useState<Severity | null>(null);

  const counts = SEVERITY_ORDER.reduce<Record<Severity, number>>(
    (acc, s) => {
      acc[s] = issues.filter((i) => i.severity === s).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const filtered =
    filter ? issues.filter((i) => i.severity === filter) : issues;

  const formattedDate = completedAt
    ? new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(completedAt))
    : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Audit Results
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {websiteUrl || websiteName}
              {formattedDate && (
                <span className="ml-2 text-border">·</span>
              )}
              {formattedDate && (
                <span className="ml-2">{formattedDate}</span>
              )}
            </p>
          </div>
          <Link
            href="/scan"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← New scan
          </Link>
        </div>
      </header>

      {/* Score + severity breakdown */}
      <section
        aria-label="SEO score and issue summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {/* Score card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          className="card-glow flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6 sm:row-span-1"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            SEO Score
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-6xl font-bold tabular-nums",
              scoreColorClass(score)
            )}
            aria-label={`SEO score: ${score} out of 100`}
          >
            {score}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">/ 100</p>
          <p className={cn("mt-1 text-xs font-medium", scoreColorClass(score))}>
            {scoreGrade(score)}
          </p>
          <div className="mt-3 flex w-full gap-2 text-xs">
            <span className="flex-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-center text-primary">
              {fixCounts.quick} quick fix{fixCounts.quick !== 1 ? "es" : ""}
            </span>
            <span className="flex-1 rounded-md border border-border bg-muted px-2 py-1 text-center text-muted-foreground">
              {fixCounts.major} major fix{fixCounts.major !== 1 ? "es" : ""}
            </span>
          </div>
        </motion.div>

        {/* Severity counts */}
        <div className="sm:col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SEVERITY_ORDER.map((severity, idx) => {
            const cfg = SEVERITY_CONFIG[severity];
            const count = counts[severity];
            const isActive = filter === severity;
            return (
              <motion.button
                key={severity}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: idx * 0.05,
                  ease: [0.23, 1, 0.32, 1],
                }}
                type="button"
                onClick={() => setFilter(isActive ? null : severity)}
                aria-pressed={isActive}
                aria-label={`Filter by ${cfg.label} issues (${count})`}
                className={cn(
                  "btn-press flex flex-col items-start rounded-lg border p-3 text-left transition-colors",
                  isActive
                    ? cn("ring-1 ring-primary/50", cfg.className)
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-block h-2 w-2 rounded-full",
                      cfg.dotClass
                    )}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium">{cfg.label}</span>
                </span>
                <span className="mt-1.5 font-mono text-2xl font-bold tabular-nums">
                  {count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Issue list */}
      <section aria-label="Issue list">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">
            {filter
              ? `${SEVERITY_CONFIG[filter].label} Issues (${filtered.length})`
              : `All Issues (${issues.length})`}
          </h2>
          {filter && (
            <button
              type="button"
              onClick={() => setFilter(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear severity filter"
            >
              Clear filter ×
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {filter
                ? `No ${SEVERITY_CONFIG[filter].label.toLowerCase()} issues found.`
                : "No issues found. Great work!"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-28 text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Issue</TableHead>
                  <TableHead className="w-24 text-xs">Fix Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((issue) => {
                  const cfg = SEVERITY_CONFIG[issue.severity];
                  return (
                    <TableRow
                      key={issue.id}
                      className="border-border align-top"
                    >
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn("text-xs font-medium", cfg.className)}
                        >
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium">{issue.title}</p>
                        {issue.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {issue.description}
                          </p>
                        )}
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">
                          {issue.type}
                        </p>
                      </TableCell>
                      <TableCell className="py-3">
                        {issue.fixType && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              issue.fixType === "quick"
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-muted text-muted-foreground"
                            )}
                          >
                            {issue.fixType === "quick" ? "Quick Fix" : "Major Fix"}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="text-xs text-muted-foreground">
        Scan ID: <span className="font-mono">{scanId}</span>
      </div>
    </div>
  );
}
