"use client";

import { useTransition } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { quickRescanAction } from "@/app/actions/rescan.actions";

type WebsiteRow = {
  id: string;
  name: string;
  url: string;
  seoScore: number | null;
  aeoScore: number | null;
  dvsScore: number | null;
  openIssues: number;
  lastScanAt: string | null;
  lastScanId: string | null;
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function scoreGradeLetter(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function relativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

function ScoreCell({ score, showGrade }: { score: number | null; showGrade?: boolean }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono font-bold tabular-nums", scoreColor(score))}>
      {score}
      {showGrade && (
        <span className="ml-1 text-xs font-normal opacity-70">{scoreGradeLetter(score)}</span>
      )}
    </span>
  );
}

function ScorePill({ label, score, showGrade }: { label: string; score: number | null; showGrade?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <ScoreCell score={score} showGrade={showGrade} />
    </div>
  );
}

function RescanButton({ websiteId }: { websiteId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleRescan() {
    startTransition(async () => {
      await quickRescanAction(websiteId);
    });
  }

  return (
    <button
      onClick={handleRescan}
      disabled={isPending}
      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? "Scanning…" : "Rescan"}
    </button>
  );
}

export function AgencyTable({ websites }: { websites: WebsiteRow[] }) {
  if (websites.length === 0) {
    return (
      <section className="card-glow rounded-xl border border-border bg-card p-12 text-center">
        <div className="animate-breathe mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
          <span className="text-xl text-primary">⊙</span>
        </div>
        <h2 className="font-semibold">No websites yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your first website to get started.
        </p>
        <Link
          href="/scan"
          className="btn-press mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start a scan →
        </Link>
      </section>
    );
  }

  return (
    <>
      {/* Desktop table — hidden on mobile */}
      <div className="card-glow hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">Website</th>
              <th className="px-4 py-3 text-center font-medium">DVS™</th>
              <th className="px-4 py-3 text-center font-medium">SEO</th>
              <th className="px-4 py-3 text-center font-medium">AEO</th>
              <th className="px-4 py-3 text-center font-medium">Open Issues</th>
              <th className="px-4 py-3 text-left font-medium">Last Scan</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {websites.map((row) => (
              <tr key={row.id} className="group transition-colors hover:bg-accent/50">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
                      aria-hidden="true"
                    >
                      {row.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">{row.name}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground max-w-[200px]">
                        {row.url}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-center">
                  <ScoreCell score={row.dvsScore} showGrade />
                </td>
                <td className="px-4 py-4 text-center">
                  <ScoreCell score={row.seoScore} />
                </td>
                <td className="px-4 py-4 text-center">
                  <ScoreCell score={row.aeoScore} />
                </td>
                <td className="px-4 py-4 text-center">
                  {row.openIssues > 0 ? (
                    <span className="inline-flex items-center justify-center rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-xs font-medium text-red-400">
                      {row.openIssues}
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-muted-foreground">0</span>
                  )}
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">
                  {row.lastScanAt ? relativeTime(row.lastScanAt) : <span className="italic">Never</span>}
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/website/${row.id}`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                    >
                      View →
                    </Link>
                    <RescanButton websiteId={row.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout — visible only below md */}
      <div className="space-y-3 md:hidden">
        {websites.map((row) => (
          <Link
            key={row.id}
            href={`/website/${row.id}`}
            className="card-glow block rounded-xl border border-border bg-card p-4 transition-colors active:bg-accent/50"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary"
                aria-hidden="true"
              >
                {row.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">
                  {row.url}
                </p>
              </div>
              {row.openIssues > 0 && (
                <span className="shrink-0 rounded-full bg-red-500/10 px-2 py-0.5 font-mono text-xs font-medium text-red-400">
                  {row.openIssues}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center gap-4 border-t border-border pt-3">
              <ScorePill label="DVS" score={row.dvsScore} showGrade />
              <ScorePill label="SEO" score={row.seoScore} />
              <ScorePill label="AEO" score={row.aeoScore} />
              <span className="ml-auto text-xs text-muted-foreground">
                {row.lastScanAt ? relativeTime(row.lastScanAt) : "Never"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
