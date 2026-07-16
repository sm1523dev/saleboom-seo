"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ignoreSuggestions, unignoreSuggestions } from "@/app/actions/suggestions.actions";
import { approveSuggestionField, unapproveField, approveAllSuggestions } from "@/app/actions/changes.actions";
import { generateAndQueueIssueFixes } from "@/app/actions/quick-fix.actions";
import type { CmsField } from "@/lib/cms/types";
import { ignoreIssues, unignoreIssues } from "@/app/actions/issues.actions";
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
  pageUrl: string | null;
  type: string;
  severity: Severity;
  title: string;
  description: string | null;
  fixType: FixType;
};

type Suggestion = {
  id: string;
  pageUrl: string;
  status: string;
  currentMetaTitle: string | null;
  currentMetaDescription: string | null;
  currentH1: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
};

type ApprovedSnapshot = {
  suggestionId: string | null;
  fieldChanged: string;
  snapshotId: string;
};

type Props = {
  scanId: string;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  completedAt: string | null;
  pagesScanned: number | null;
  totalPages: number | null;
  score: number;
  fixCounts: { quick: number; major: number };
  issues: Issue[];
  ignoredIssues: Issue[];
  queuedIssueIds: string[];
  fixedIssueIds: string[];
  suggestions: Suggestion[];
  pastSuggestions: Suggestion[];
  approvedSnapshots: ApprovedSnapshot[];
  cmsConnected: boolean;
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
  websiteId,
  websiteName,
  websiteUrl,
  completedAt,
  pagesScanned,
  totalPages,
  score,
  fixCounts,
  issues,
  ignoredIssues,
  queuedIssueIds,
  fixedIssueIds,
  suggestions,
  pastSuggestions,
  approvedSnapshots,
  cmsConnected,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Severity | null>(null);
  const [fixFilter, setFixFilter] = useState<"quick" | "major" | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());

  const queuedSet = new Set(queuedIssueIds);
  const fixedSet = new Set(fixedIssueIds);
  const [localIgnoredIds, setLocalIgnoredIds] = useState<Set<string>>(new Set());
  const [showIssueCmsPrompt, setShowIssueCmsPrompt] = useState(false);
  const [isIgnoringIssues, startIgnoreIssuesTransition] = useTransition();
  const [showIgnoredIssues, setShowIgnoredIssues] = useState(false);
  const [showQueuedIssues, setShowQueuedIssues] = useState(false);
  const [showFixedIssues, setShowFixedIssues] = useState(false);
  const [isUnignoringIssues, startUnignoreIssuesTransition] = useTransition();

  // Active = not queued, not fixed, not ignored (locally or from server)
  const activeIssues = issues.filter((i) => !queuedSet.has(i.id) && !fixedSet.has(i.id) && !localIgnoredIds.has(i.id));
  const fixFiltered = activeIssues.filter((i) => !fixFilter || i.fixType === fixFilter);
  const counts = SEVERITY_ORDER.reduce<Record<Severity, number>>(
    (acc, s) => {
      acc[s] = fixFiltered.filter((i) => i.severity === s).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const filtered = fixFiltered.filter((i) => !filter || i.severity === filter);

  const queuedIssues = issues.filter((i) => queuedSet.has(i.id));
  const resolvedIssues = issues.filter((i) => fixedSet.has(i.id));

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Audit Results
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {websiteUrl || websiteName}
              {formattedDate && <span className="ml-2 text-border">·</span>}
              {formattedDate && <span className="ml-2">{formattedDate}</span>}
              {pagesScanned != null && (
                <>
                  <span className="ml-2 text-border">·</span>
                  <span className="ml-2 font-mono">
                    {pagesScanned}{totalPages && totalPages > pagesScanned ? `/${totalPages}` : ""} pages scanned
                  </span>
                </>
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
            <button
              type="button"
              onClick={() => setFixFilter(fixFilter === "quick" ? null : "quick")}
              aria-pressed={fixFilter === "quick"}
              className={cn(
                "btn-press flex-1 rounded-md border px-2 py-1 text-center transition-colors",
                fixFilter === "quick"
                  ? "border-primary/50 bg-primary/20 text-primary ring-1 ring-primary/30"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {fixCounts.quick} quick fix{fixCounts.quick !== 1 ? "es" : ""}
            </button>
            <button
              type="button"
              onClick={() => setFixFilter(fixFilter === "major" ? null : "major")}
              aria-pressed={fixFilter === "major"}
              className={cn(
                "btn-press flex-1 rounded-md border px-2 py-1 text-center transition-colors",
                fixFilter === "major"
                  ? "border-foreground/30 bg-foreground/10 text-foreground ring-1 ring-foreground/20"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {fixCounts.major} major fix{fixCounts.major !== 1 ? "es" : ""}
            </button>
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

      {/* AI Suggestions */}
      {(suggestions.length > 0 || pastSuggestions.length > 0) && (
        <AiSuggestionsSection suggestions={suggestions} pastSuggestions={pastSuggestions} approvedSnapshots={approvedSnapshots} />
      )}

      {/* Issue list */}
      <section aria-label="Issue list">
        {/* CMS prompt for issues */}
        {showIssueCmsPrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3 className="font-semibold">Connect your CMS to push fixes</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Quick fixes can be applied directly to your website with one click once your CMS is connected.
                Supports WordPress, Shopify, and Webflow.
              </p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setShowIssueCmsPrompt(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent">
                  Not now
                </button>
                <Link
                  href={`/website/${websiteId}/cms`}
                  onClick={() => setShowIssueCmsPrompt(false)}
                  className="btn-press flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Connect CMS →
                </Link>
              </div>
            </motion.div>
          </div>
        )}

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-semibold">
            {filter
              ? `${SEVERITY_CONFIG[filter].label} Issues (${filtered.length})`
              : fixFilter
                ? `${fixFilter === "quick" ? "Quick Fix" : "Major Fix"} Issues (${filtered.length})`
                : `All Issues (${activeIssues.length})`}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {(filter || fixFilter) && (
              <button
                type="button"
                onClick={() => { setFilter(null); setFixFilter(null); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear filters"
              >
                Clear filter ×
              </button>
            )}
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="rounded"
                checked={selectedIssues.size === filtered.length && filtered.length > 0}
                onChange={() => {
                  if (selectedIssues.size === filtered.length) {
                    setSelectedIssues(new Set());
                  } else {
                    setSelectedIssues(new Set(filtered.map((i) => i.id)));
                  }
                }}
                aria-label="Select all issues"
              />
              {selectedIssues.size > 0 ? `${selectedIssues.size} selected` : "Select all"}
            </label>
            <button
              type="button"
              onClick={() => {
                const ids = selectedIssues.size > 0
                  ? Array.from(selectedIssues)
                  : filtered.map((i) => i.id);
                setLocalIgnoredIds((prev) => new Set([...prev, ...ids]));
                startIgnoreIssuesTransition(async () => {
                  await ignoreIssues(ids);
                  setSelectedIssues(new Set());
                  router.refresh();
                });
              }}
              disabled={isIgnoringIssues}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              {selectedIssues.size > 0
                ? `Ignore ${selectedIssues.size} selected`
                : `Ignore all`}
            </button>
            {(filtered.some((i) => i.fixType === "quick") || !cmsConnected) && (
              <BulkFixButton
                selectedIssues={selectedIssues}
                allQuickIssues={filtered.filter((i) => i.fixType === "quick" && !queuedSet.has(i.id) && !fixedSet.has(i.id))}
                websiteId={websiteId}
                cmsConnected={cmsConnected}
              />
            )}
          </div>
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
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-8 pr-0" />
                  <TableHead className="w-28 text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Issue</TableHead>
                  <TableHead className="w-24 text-xs">Fix Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((issue) => {
                  const cfg = SEVERITY_CONFIG[issue.severity];
                  const isQuick = issue.fixType === "quick";
                  return (
                    <TableRow
                      key={issue.id}
                      className={cn("border-border align-top", isQuick && selectedIssues.has(issue.id) && "bg-primary/5")}
                    >
                      <TableCell className="py-3 w-8 pr-0">
                        {isQuick && (
                          <input
                            type="checkbox"
                            checked={selectedIssues.has(issue.id)}
                            onChange={() => setSelectedIssues((prev) => {
                              const next = new Set(prev);
                              if (next.has(issue.id)) next.delete(issue.id);
                              else next.add(issue.id);
                              return next;
                            })}
                            className="rounded"
                            aria-label={`Select ${issue.title}`}
                          />
                        )}
                      </TableCell>
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

      {/* Ignored issues */}
      {ignoredIssues.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIgnoredIssues((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showIgnoredIssues ? "Hide" : "Show"} ignored ({ignoredIssues.length})
          </button>
          <AnimatePresence initial={false}>
            {showIgnoredIssues && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="mt-3 overflow-hidden"
              >
                <div className="overflow-x-auto rounded-xl border border-border bg-card opacity-60">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs">Issue</TableHead>
                        <TableHead className="w-24 text-xs" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ignoredIssues.map((issue) => {
                        const cfg = SEVERITY_CONFIG[issue.severity as Severity];
                        return (
                          <TableRow key={issue.id} className="border-border align-top">
                            <TableCell className="py-3">
                              <Badge variant="outline" className={cn("text-xs font-medium", cfg?.className)}>
                                {cfg?.label ?? issue.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="text-sm font-medium line-through text-muted-foreground">{issue.title}</p>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{issue.type}</p>
                            </TableCell>
                            <TableCell className="py-3 text-right">
                              <button
                                type="button"
                                disabled={isUnignoringIssues}
                                onClick={() => startUnignoreIssuesTransition(async () => {
                                  await unignoreIssues([issue.id]);
                                  router.refresh();
                                })}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                              >
                                Un-ignore
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* In Queue */}
      {queuedIssues.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowQueuedIssues((o) => !o)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-primary/60" aria-hidden="true" />
            {showQueuedIssues ? "Hide" : "Show"} in queue ({queuedIssues.length})
          </button>
          <AnimatePresence initial={false}>
            {showQueuedIssues && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="mt-3 overflow-hidden"
              >
                <div className="overflow-x-auto rounded-xl border border-primary/20 bg-card opacity-80">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs">Issue</TableHead>
                        <TableHead className="w-24 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {queuedIssues.map((issue) => {
                        const cfg = SEVERITY_CONFIG[issue.severity as Severity];
                        return (
                          <TableRow key={issue.id} className="border-border align-top">
                            <TableCell className="py-3">
                              <Badge variant="outline" className={cn("text-xs font-medium", cfg?.className)}>
                                {cfg?.label ?? issue.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="text-sm font-medium">{issue.title}</p>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{issue.type}</p>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">
                                In Queue
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Fixed */}
      {resolvedIssues.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowFixedIssues((o) => !o)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
            {showFixedIssues ? "Hide" : "Show"} fixed ({resolvedIssues.length})
          </button>
          <AnimatePresence initial={false}>
            {showFixedIssues && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="mt-3 overflow-hidden"
              >
                <div className="overflow-x-auto rounded-xl border border-green-500/20 bg-card opacity-70">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs">Issue</TableHead>
                        <TableHead className="w-24 text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resolvedIssues.map((issue) => {
                        const cfg = SEVERITY_CONFIG[issue.severity as Severity];
                        return (
                          <TableRow key={issue.id} className="border-border align-top">
                            <TableCell className="py-3">
                              <Badge variant="outline" className={cn("text-xs font-medium", cfg?.className)}>
                                {cfg?.label ?? issue.severity}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <p className="text-sm font-medium line-through text-muted-foreground">{issue.title}</p>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{issue.type}</p>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400 text-xs">
                                Fixed
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        Scan ID: <span className="font-mono">{scanId}</span>
      </div>
    </div>
  );
}

const FIELDS: { key: "metaTitle" | "metaDescription" | "h1"; currentKey: "currentMetaTitle" | "currentMetaDescription" | "currentH1"; label: string; hint: string; fieldId: CmsField }[] = [
  { key: "metaTitle", currentKey: "currentMetaTitle", label: "Page Title", hint: "50–60 chars", fieldId: "meta_title" },
  { key: "metaDescription", currentKey: "currentMetaDescription", label: "Page Description", hint: "150–160 chars", fieldId: "meta_description" },
  { key: "h1", currentKey: "currentH1", label: "Main Heading", hint: "Primary on-page heading", fieldId: "h1" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
      className="shrink-0 rounded-md border border-border px-2 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function BulkFixButton({ selectedIssues, allQuickIssues, websiteId, cmsConnected }: { selectedIssues: Set<string>; allQuickIssues: Issue[]; websiteId: string; cmsConnected: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [generating, setGenerating] = useState(false);
  const [totalGenerating, setTotalGenerating] = useState(0);

  // No CMS connected — show a direct link to the CMS settings page, no dialog
  if (!cmsConnected) {
    return (
      <Link
        href={`/website/${websiteId}/cms`}
        className="btn-press rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90"
      >
        Connect CMS to apply fixes
      </Link>
    );
  }

  const targetIds = selectedIssues.size > 0
    ? Array.from(selectedIssues).filter((id) => allQuickIssues.some((i) => i.id === id && i.fixType === "quick"))
    : allQuickIssues.map((i) => i.id);

  if (targetIds.length === 0) return null;

  const label = selectedIssues.size > 0
    ? `Fix ${targetIds.length} selected`
    : `Fix all ${targetIds.length} quick fixes`;

  return (
    <>
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary"
            />
            <p className="font-semibold">Generating AI fixes…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Processing {totalGenerating} issue{totalGenerating !== 1 ? "s" : ""} — please wait
            </p>
            <p className="mt-3 text-xs text-muted-foreground">You'll be redirected to the queue when ready</p>
          </motion.div>
        </div>
      )}
      <button
        type="button"
        disabled={isPending || generating}
        onClick={() => startTransition(async () => {
          setTotalGenerating(targetIds.length);
          setGenerating(true);
          await generateAndQueueIssueFixes(targetIds);
          setGenerating(false);
          router.push("/changes");
        })}
        className="btn-press rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
      >
        {label}
      </button>
    </>
  );
}

const CHAR_LIMITS: Record<CmsField, { min: number; max: number }> = {
  meta_title: { min: 50, max: 60 },
  meta_description: { min: 150, max: 160 },
  h1: { min: 0, max: 70 },
};

function CharCount({ text, field }: { text: string; field: CmsField }) {
  const len = text.length;
  const { min, max } = CHAR_LIMITS[field];
  const inRange = len >= min && len <= max;
  const over = len > max;
  return (
    <span className={cn("font-mono text-xs", inRange ? "text-green-400" : over ? "text-red-400" : "text-yellow-400")}>
      {len}/{max}
    </span>
  );
}

function AiSuggestionsSection({
  suggestions,
  pastSuggestions,
  approvedSnapshots,
}: {
  suggestions: Suggestion[];
  pastSuggestions: Suggestion[];
  approvedSnapshots: ApprovedSnapshot[];
}) {
  const [open, setOpen] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [isUnignoring, startUnignoreTransition] = useTransition();
  const [isBulkApproving, startBulkTransition] = useTransition();
  const router = useRouter();

  function handleApproveAll() {
    startBulkTransition(async () => {
      await approveAllSuggestions(suggestions.map((s) => s.id));
      router.push("/changes");
    });
  }

  // Track per-suggestion per-field state: "idle" | "approved" | "skipped"
  type FieldState = "idle" | "approved" | "skipped";
  const [fieldStates, setFieldStates] = useState<Record<string, Record<string, FieldState>>>(() => {
    const initial: Record<string, Record<string, FieldState>> = {};
    for (const s of suggestions) {
      initial[s.id] = { meta_title: "idle", meta_description: "idle", h1: "idle" };
    }
    // Restore approvals from server
    for (const snap of approvedSnapshots) {
      if (snap.suggestionId && initial[snap.suggestionId]) {
        initial[snap.suggestionId][snap.fieldChanged] = "approved";
      }
    }
    return initial;
  });

  const [pendingFields, setPendingFields] = useState<Set<string>>(new Set());

  async function handleApproveField(suggestionId: string, field: CmsField) {
    const key = `${suggestionId}:${field}`;
    setPendingFields((p) => new Set(p).add(key));
    try {
      await approveSuggestionField(suggestionId, field);
      setFieldStates((prev) => ({
        ...prev,
        [suggestionId]: { ...prev[suggestionId], [field]: "approved" },
      }));
    } finally {
      setPendingFields((p) => { const next = new Set(p); next.delete(key); return next; });
    }
  }

  async function handleUnapproveField(suggestionId: string, field: CmsField) {
    const key = `${suggestionId}:${field}`;
    setPendingFields((p) => new Set(p).add(key));
    try {
      await unapproveField(suggestionId, field);
      setFieldStates((prev) => ({
        ...prev,
        [suggestionId]: { ...prev[suggestionId], [field]: "idle" },
      }));
    } finally {
      setPendingFields((p) => { const next = new Set(p); next.delete(key); return next; });
    }
  }

  function handleSkipField(suggestionId: string, field: CmsField) {
    setFieldStates((prev) => ({
      ...prev,
      [suggestionId]: { ...prev[suggestionId], [field]: "skipped" },
    }));
  }

  function handleUnskipField(suggestionId: string, field: CmsField) {
    setFieldStates((prev) => ({
      ...prev,
      [suggestionId]: { ...prev[suggestionId], [field]: "idle" },
    }));
  }

  function countApprovedFields(suggestionId: string) {
    return Object.values(fieldStates[suggestionId] ?? {}).filter((s) => s === "approved").length;
  }

  if (suggestions.length === 0 && pastSuggestions.length === 0) return null;

  return (
    <section id="ai-suggestions" aria-label="AI-generated page improvements" className="space-y-3">
      {suggestions.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex flex-1 items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
              aria-expanded={open}
            >
              <div>
                <span className="font-semibold">
                  AI-Suggested Improvements
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {suggestions.length} page{suggestions.length !== 1 ? "s" : ""}
                  </span>
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Approve fields to add to CMS queue, or approve all at once
                </p>
              </div>
              <span className={cn("ml-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden="true">
                ▾
              </span>
            </button>
            <button
              type="button"
              onClick={handleApproveAll}
              disabled={isBulkApproving}
              className="btn-press shrink-0 rounded-xl border border-primary/50 bg-primary/10 px-4 py-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
            >
              {isBulkApproving ? "Adding…" : "Approve all →"}
            </button>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  {suggestions.map((s) => {
                    const states = fieldStates[s.id] ?? {};
                    const approvedCount = countApprovedFields(s.id);
                    return (
                      <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <p className="truncate font-mono text-xs text-muted-foreground">{s.pageUrl}</p>
                          {approvedCount > 0 && (
                            <span className="shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-400">
                              {approvedCount} approved
                            </span>
                          )}
                        </div>
                        <div className="space-y-5">
                          {FIELDS.map(({ key, currentKey, label, hint, fieldId }) => {
                            const suggested = s[key];
                            if (!suggested) return null;
                            const current = s[currentKey];
                            const fieldState = states[fieldId] ?? "idle";
                            const isPendingField = pendingFields.has(`${s.id}:${fieldId}`);

                            if (fieldState === "skipped") {
                              return (
                                <div key={key} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                                  <span className="text-xs text-muted-foreground/60 line-through">{label}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleUnskipField(s.id, fieldId)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Un-skip
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div
                                key={key}
                                className={cn(
                                  "rounded-lg border p-3 transition-colors",
                                  fieldState === "approved" && "border-green-500/20 bg-green-500/5",
                                  fieldState === "idle" && "border-border",
                                )}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <div className="flex items-baseline gap-2">
                                    <span className="text-xs font-medium">{label}</span>
                                    <span className="text-xs text-muted-foreground">{hint}</span>
                                  </div>
                                  {fieldState === "approved" && (
                                    <span className="flex items-center gap-1 text-xs text-green-400">
                                      ✓ Approved
                                      <button
                                        type="button"
                                        onClick={() => handleUnapproveField(s.id, fieldId)}
                                        disabled={isPendingField}
                                        className="ml-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                                        aria-label={`Unapprove ${label}`}
                                      >
                                        undo
                                      </button>
                                    </span>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div>
                                    <p className="mb-1 text-xs font-medium text-muted-foreground">Current</p>
                                    <div className="min-h-[2.5rem] rounded-lg border border-border bg-muted/30 px-3 py-2">
                                      {current
                                        ? <p className="text-sm text-muted-foreground">{current}</p>
                                        : <p className="text-sm italic text-muted-foreground/50">Not set</p>}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="mb-1 flex items-center justify-between">
                                      <p className="text-xs font-medium text-primary">AI Suggestion</p>
                                      <CharCount text={suggested} field={fieldId} />
                                    </div>
                                    <div className="flex min-h-[2.5rem] items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                                      <p className="flex-1 text-sm">{suggested}</p>
                                      <CopyButton text={suggested} />
                                    </div>
                                  </div>
                                </div>

                                {fieldState === "idle" && (
                                  <div className="mt-2 flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSkipField(s.id, fieldId)}
                                      className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      Skip
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveField(s.id, fieldId)}
                                      disabled={isPendingField}
                                      className="btn-press rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {isPendingField ? "Approving…" : "Approve"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Ignored suggestions */}
      {pastSuggestions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIgnored((o) => !o)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {showIgnored ? "Hide" : "Show"} ignored ({pastSuggestions.length})
          </button>
          <AnimatePresence initial={false}>
            {showIgnored && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="mt-3 space-y-3 overflow-hidden"
              >
                {pastSuggestions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-border bg-card p-4 opacity-60">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-xs text-muted-foreground">{s.pageUrl}</p>
                      <button
                        type="button"
                        disabled={isUnignoring}
                        onClick={() => startUnignoreTransition(async () => {
                          await unignoreSuggestions([s.id]);
                          router.refresh();
                        })}
                        className="shrink-0 text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Un-ignore
                      </button>
                    </div>
                    <div className="space-y-2">
                      {FIELDS.map(({ key, label }) => {
                        const suggested = s[key];
                        if (!suggested) return null;
                        return (
                          <div key={key} className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="text-xs text-muted-foreground">{label}</p>
                              <p className="mt-0.5 text-sm line-through text-muted-foreground">{suggested}</p>
                            </div>
                            <CopyButton text={suggested} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
