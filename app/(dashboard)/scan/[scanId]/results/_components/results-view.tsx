"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ignoreSuggestions, unignoreSuggestions } from "@/app/actions/suggestions.actions";
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

type Props = {
  scanId: string;
  websiteName: string;
  websiteUrl: string;
  completedAt: string | null;
  pagesScanned: number | null;
  totalPages: number | null;
  score: number;
  fixCounts: { quick: number; major: number };
  issues: Issue[];
  ignoredIssues: Issue[];
  suggestions: Suggestion[];
  pastSuggestions: Suggestion[];
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
  pagesScanned,
  totalPages,
  score,
  fixCounts,
  issues,
  ignoredIssues,
  suggestions,
  pastSuggestions,
}: Props) {
  const router = useRouter();
  const [filter, setFilter] = useState<Severity | null>(null);
  const [fixFilter, setFixFilter] = useState<"quick" | "major" | null>(null);
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());
  const [showIssueCmsPrompt, setShowIssueCmsPrompt] = useState(false);
  const [isIgnoringIssues, startIgnoreIssuesTransition] = useTransition();
  const [showIgnoredIssues, setShowIgnoredIssues] = useState(false);
  const [isUnignoringIssues, startUnignoreIssuesTransition] = useTransition();

  const fixFiltered = issues.filter((i) => !fixFilter || i.fixType === fixFilter);
  const counts = SEVERITY_ORDER.reduce<Record<Severity, number>>(
    (acc, s) => {
      acc[s] = fixFiltered.filter((i) => i.severity === s).length;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  );

  const filtered = fixFiltered.filter((i) => !filter || i.severity === filter);

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
        <AiSuggestionsSection suggestions={suggestions} pastSuggestions={pastSuggestions} />
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
              <h3 className="font-semibold">Connect your CMS to auto-fix</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Quick fixes can be applied directly to your website with one click — once your CMS is connected.
                WordPress, Shopify, and Webflow support coming soon.
              </p>
              <div className="mt-5 flex gap-3">
                <button type="button" onClick={() => setShowIssueCmsPrompt(false)} className="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent">
                  Got it
                </button>
                <button type="button" disabled className="flex-1 cursor-not-allowed rounded-lg bg-primary/40 px-4 py-2 text-sm font-medium text-primary-foreground">
                  Connect CMS — Coming soon
                </button>
              </div>
            </motion.div>
          </div>
        )}

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">
            {filter
              ? `${SEVERITY_CONFIG[filter].label} Issues (${filtered.length})`
              : fixFilter
                ? `${fixFilter === "quick" ? "Quick Fix" : "Major Fix"} Issues (${filtered.length})`
                : `All Issues (${issues.length})`}
          </h2>
          <div className="flex items-center gap-2">
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
            {/* Issue bulk actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const ids = selectedIssues.size > 0
                    ? Array.from(selectedIssues)
                    : filtered.map((i) => i.id);
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
              {filtered.some((i) => i.fixType === "quick") && (
                <button
                  type="button"
                  onClick={() => setShowIssueCmsPrompt(true)}
                  title="CMS connection required — coming soon"
                  className="btn-press rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90"
                >
                  {selectedIssues.size > 0
                    ? `Fix ${selectedIssues.size} issue${selectedIssues.size !== 1 ? "s" : ""}`
                    : `Fix all ${filtered.filter((i) => i.fixType === "quick").length} quick fixes`}
                </button>
              )}
            </div>
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
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
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
                <div className="overflow-hidden rounded-xl border border-border bg-card opacity-60">
                  <Table>
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

      <div className="text-xs text-muted-foreground">
        Scan ID: <span className="font-mono">{scanId}</span>
      </div>
    </div>
  );
}

const FIELDS: { key: "metaTitle" | "metaDescription" | "h1"; currentKey: "currentMetaTitle" | "currentMetaDescription" | "currentH1"; label: string; hint: string }[] = [
  { key: "metaTitle", currentKey: "currentMetaTitle", label: "Page Title", hint: "Shown as the headline in Google search results" },
  { key: "metaDescription", currentKey: "currentMetaDescription", label: "Page Description", hint: "The short summary shown under the title in Google results" },
  { key: "h1", currentKey: "currentH1", label: "Main Heading", hint: "The primary heading visitors see when they land on the page" },
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

function AiSuggestionsSection({ suggestions, pastSuggestions }: { suggestions: Suggestion[]; pastSuggestions: Suggestion[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [showCmsPrompt, setShowCmsPrompt] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);
  const [isUnignoring, startUnignoreTransition] = useTransition();
  const router = useRouter();

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === suggestions.length) setSelected(new Set());
    else setSelected(new Set(suggestions.map((s) => s.id)));
  }

  function handleApply() {
    setShowCmsPrompt(true);
  }

  function handleIgnoreSelected() {
    const ids = selected.size > 0 ? Array.from(selected) : suggestions.map((s) => s.id);
    startTransition(async () => {
      await ignoreSuggestions(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  const applyLabel = selected.size > 0
    ? `Apply ${selected.size} suggestion${selected.size !== 1 ? "s" : ""}`
    : `Apply all ${suggestions.length} suggestions`;

  const ignoreLabel = selected.size > 0
    ? `Ignore ${selected.size} selected`
    : "Ignore all";

  return (
    <section aria-label="AI-generated page improvements" className="space-y-3">
      {/* CMS prompt popup */}
      {showCmsPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h3 className="font-semibold">Connect your CMS to apply</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              One-click apply is coming soon. Connect your CMS (WordPress, Shopify, Webflow)
              and we'll push these fixes directly to your site — no copy-paste needed.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCmsPrompt(false)}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-accent"
              >
                Got it
              </button>
              <button
                type="button"
                disabled
                className="flex-1 cursor-not-allowed rounded-lg bg-primary/40 px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Connect CMS — Coming soon
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Active suggestions */}
      {suggestions.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent"
            aria-expanded={open}
          >
            <div>
              <span className="font-semibold">
                Suggested Page Improvements
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {suggestions.length} page{suggestions.length !== 1 ? "s" : ""}
                </span>
              </span>
              <p className="mt-0.5 text-xs text-muted-foreground">
                See current content vs AI suggestion — select pages to apply or skip
              </p>
            </div>
            <span className={cn("ml-4 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} aria-hidden="true">
              ▾
            </span>
          </button>

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
                  {/* Bulk actions bar */}
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={selected.size === suggestions.length && suggestions.length > 0}
                        onChange={toggleAll}
                        className="rounded"
                        aria-label="Select all suggestions"
                      />
                      {selected.size > 0 ? `${selected.size} selected` : "Select all"}
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleIgnoreSelected}
                        disabled={isPending}
                        className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                      >
                        {ignoreLabel}
                      </button>
                      <button
                        type="button"
                        onClick={handleApply}
                        disabled={suggestions.length === 0}
                        title="CMS connection required — coming soon"
                        className="btn-press rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:bg-primary/90 disabled:opacity-50"
                      >
                        {applyLabel}
                      </button>
                    </div>
                  </div>

                  {/* Suggestion cards */}
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-xl border bg-card p-4 transition-colors",
                        selected.has(s.id) ? "border-primary/40 bg-primary/5" : "border-border"
                      )}
                    >
                      <label className="mb-4 flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.has(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="rounded"
                        />
                        <span className="truncate font-mono text-xs text-muted-foreground">{s.pageUrl}</span>
                      </label>
                      <div className="space-y-5">
                        {FIELDS.map(({ key, currentKey, label, hint }) => {
                          const suggested = s[key];
                          if (!suggested) return null;
                          const current = s[currentKey];
                          return (
                            <div key={key}>
                              <div className="mb-2 flex items-baseline gap-2">
                                <span className="text-xs font-medium">{label}</span>
                                <span className="text-xs text-muted-foreground">{hint}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <div>
                                  <p className="mb-1 text-xs font-medium text-muted-foreground">Current</p>
                                  <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 min-h-[2.5rem]">
                                    {current
                                      ? <p className="text-sm text-muted-foreground">{current}</p>
                                      : <p className="text-sm italic text-muted-foreground/50">Not set</p>}
                                  </div>
                                </div>
                                <div>
                                  <p className="mb-1 text-xs font-medium text-primary">AI Suggestion</p>
                                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 min-h-[2.5rem]">
                                    <p className="flex-1 text-sm">{suggested}</p>
                                    <CopyButton text={suggested} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* Ignored suggestions toggle */}
      {pastSuggestions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowIgnored((o) => !o)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                className="mt-3 overflow-hidden space-y-3"
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
