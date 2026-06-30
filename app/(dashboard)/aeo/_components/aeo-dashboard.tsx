"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { scoreColorClass, scoreGrade } from "@/lib/seo-score";

type Provider = { id: string; displayName: string; model: string };
type MentionStat = { providerId: string; total: number; mentioned: number };
type ReferralStat = { platform: string; count: number };
type Citation = { citedUrl: string; providerId: string; scanDate: string; providerName: string };

type Props = {
  providers: Provider[];
  mentionStats: MentionStat[];
  referralStats: ReferralStat[];
  recentCitations: Citation[];
  compositeScore: number | null;
  scoredAt: string | null;
};

const EASE = [0.23, 1, 0.32, 1] as const;

export function AeoDashboard({
  providers,
  mentionStats,
  referralStats,
  recentCitations,
  compositeScore,
  scoredAt,
}: Props) {
  const score = compositeScore ?? 0;
  const statsMap = new Map(mentionStats.map((s) => [s.providerId, s]));

  const formattedDate = scoredAt
    ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(scoredAt))
    : null;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Visibility</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              How AI tools mention, cite, and send traffic to your brand
            </p>
          </div>
          <Link
            href="/aeo/setup"
            className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Install tracker →
          </Link>
        </div>
      </header>

      {/* Composite AEO score */}
      <section aria-label="AEO composite score">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="card-glow flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8"
        >
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            AEO Score
          </p>
          <p
            className={cn("mt-2 font-mono text-6xl font-bold tabular-nums", scoreColorClass(score))}
            aria-label={`AEO score: ${score} out of 100`}
          >
            {score}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">/ 100</p>
          <p className={cn("mt-1 text-xs font-medium", scoreColorClass(score))}>
            {scoreGrade(score)}
          </p>
          {formattedDate && (
            <p className="mt-2 text-xs text-muted-foreground">Last updated {formattedDate}</p>
          )}
          {compositeScore === null && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Score will appear after the first AEO scan runs (daily at 03:00 UTC).
            </p>
          )}
        </motion.div>
      </section>

      {/* Signal 1 — Mention rate per provider */}
      <section aria-label="AI mention rate by platform">
        <h2 className="mb-3 font-semibold">
          Signal 1 — Mention Rate
          <span className="ml-2 text-xs font-normal text-muted-foreground">last 30 days</span>
        </h2>
        {providers.length === 0 ? (
          <EmptyState message="No AI providers configured. The first AEO scan will seed them automatically." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {providers.map((p, idx) => {
              const stat = statsMap.get(p.id);
              const rate = stat && stat.total > 0 ? Math.round((stat.mentioned / stat.total) * 100) : null;
              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05, ease: EASE }}
                  className="card-glow flex flex-col rounded-xl border border-border bg-card p-4"
                >
                  <p className="text-xs font-medium">{p.displayName}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{p.model}</p>
                  <p className="mt-3 font-mono text-3xl font-bold tabular-nums">
                    {rate !== null ? `${rate}%` : "—"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {stat ? `${stat.mentioned} of ${stat.total} queries` : "No data yet"}
                  </p>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Signal 2 — Real AI referral traffic */}
      <section aria-label="Real AI referral traffic">
        <h2 className="mb-3 font-semibold">
          Signal 2 — Real AI Traffic
          <span className="ml-2 text-xs font-normal text-muted-foreground">last 30 days</span>
        </h2>
        {referralStats.length === 0 ? (
          <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No AI referrals recorded yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href="/aeo/setup" className="text-primary hover:underline">
                Install the tracking snippet →
              </Link>{" "}
              to capture real visits from ChatGPT, Perplexity, Claude, and more.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">AI Platform</TableHead>
                  <TableHead className="w-24 text-right text-xs">Visits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referralStats.map((r) => (
                  <TableRow key={r.platform} className="border-border">
                    <TableCell className="py-3 font-mono text-sm">{r.platform}</TableCell>
                    <TableCell className="py-3 text-right font-mono text-sm font-medium">
                      {r.count}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Signal 3 — Citations */}
      <section aria-label="AI citation appearances">
        <h2 className="mb-3 font-semibold">
          Signal 3 — Citations
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            your pages cited by AI tools
          </span>
        </h2>
        {recentCitations.length === 0 ? (
          <EmptyState message="No citations recorded yet. Citations appear when RAG-based AI tools (e.g. Perplexity) cite your pages as sources." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs">Cited URL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentCitations.map((c, idx) => (
                  <TableRow key={idx} className="border-border align-top">
                    <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                      {String(c.scanDate).slice(0, 10)}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary">
                        {c.providerName}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs py-3">
                      <p className="truncate font-mono text-xs text-muted-foreground">{c.citedUrl}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="card-glow rounded-xl border border-border bg-card p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
