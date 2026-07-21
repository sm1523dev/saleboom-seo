import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, isNull, inArray, sql, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, aeoMentions, aeoProviders, aeoScores, dvsScores, aeoCitations, aiReferrals, aeoQueries } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore, scoreColorClass, scoreGrade } from "@/lib/seo-score";
import { computeDvsScore } from "@/lib/dvs/score";
import { TrendChart } from "@/components/shared/trend-chart";
import { CountUp } from "@/components/animations/count-up";
import { ScanProgressBanner } from "./_components/scan-progress-banner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LocalTime } from "@/components/shared/local-time";

export const metadata: Metadata = {
  title: "Website Overview",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ websiteId: string }> };

export default async function WebsiteDetailPage({ params }: Props) {
  const { websiteId } = await params;
  const session = await getServerSession();

  const [site] = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .limit(1);

  if (!site) notFound();

  // Latest completed scan
  const [latestScan] = await db
    .select({ id: scans.id, completedAt: scans.completedAt })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed"), isNull(scans.deletedAt)))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  // Previous completed scan (for deltas)
  const [prevScan] = latestScan
    ? await db
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed"), isNull(scans.deletedAt)))
        .orderBy(desc(scans.completedAt))
        .offset(1)
        .limit(1)
    : [null];

  let seoScore = 0;
  let seoDelta = 0;
  let openIssueCount = 0;
  let topIssues: TopIssue[] = [];
  let resolvedSinceLastScan = 0;
  let newCriticalCount = 0;

  if (latestScan) {
    const scanIssues = await db
      .select({ id: issues.id, type: issues.type, severity: issues.severity, title: issues.title, fixType: issues.fixType })
      .from(issues)
      .where(and(eq(issues.scanId, latestScan.id), isNull(issues.resolvedAt)));

    seoScore = computeSeoScore(scanIssues);
    openIssueCount = scanIssues.length;

    newCriticalCount = new Set(scanIssues.filter((i) => i.severity === "critical").map((i) => i.type)).size;

    const seenTypes = new Set<string>();
    topIssues = scanIssues
      .filter((i) => i.severity === "critical" || i.severity === "high")
      .sort((a, b) => (a.severity === "critical" ? -1 : 1))
      .filter((i) => {
        if (seenTypes.has(i.type)) return false;
        seenTypes.add(i.type);
        return true;
      })
      .slice(0, 5);

    if (prevScan) {
      const prevIssues = await db
        .select({ type: issues.type, severity: issues.severity })
        .from(issues)
        .where(and(eq(issues.scanId, prevScan.id), isNull(issues.resolvedAt)));
      const prevScore = computeSeoScore(prevIssues);
      seoDelta = seoScore - prevScore;
      resolvedSinceLastScan = Math.max(0, prevIssues.length - openIssueCount);
    }
  }

  // AEO scores
  const [latestAeo, prevAeo] = await db
    .select({ compositeScore: aeoScores.compositeScore, scoredAt: aeoScores.scoredAt })
    .from(aeoScores)
    .where(eq(aeoScores.websiteId, websiteId))
    .orderBy(desc(aeoScores.scoredAt))
    .limit(2);

  const aeoScore = latestAeo ? Math.round(latestAeo.compositeScore) : 0;
  const aeoDelta = latestAeo && prevAeo ? Math.round(latestAeo.compositeScore - prevAeo.compositeScore) : 0;
  const aeoScanRunning = !latestAeo;

  // DVS
  const dvsScore = computeDvsScore(seoScore, aeoScore);
  const [latestDvs, prevDvs] = await db
    .select({ compositeScore: dvsScores.compositeScore })
    .from(dvsScores)
    .where(eq(dvsScores.websiteId, websiteId))
    .orderBy(desc(dvsScores.scoredAt))
    .limit(2);
  const dvsDelta = latestDvs && prevDvs ? Math.round(latestDvs.compositeScore - prevDvs.compositeScore) : 0;

  // AEO per-provider stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);

  const providers = await db
    .select({ id: aeoProviders.id, displayName: aeoProviders.displayName })
    .from(aeoProviders)
    .where(eq(aeoProviders.enabled, true));

  const providerIds = providers.map((p) => p.id);
  const mentionStats = providerIds.length > 0
    ? await db
        .select({
          providerId: aeoMentions.providerId,
          total: sql<number>`count(*)::int`,
          mentioned: sql<number>`count(*) filter (where ${aeoMentions.brandMentioned})::int`,
        })
        .from(aeoMentions)
        .where(and(eq(aeoMentions.websiteId, websiteId), inArray(aeoMentions.providerId, providerIds), gte(aeoMentions.scanDate, cutoff)))
        .groupBy(aeoMentions.providerId)
    : [];

  const statsMap = new Map(mentionStats.map((s) => [s.providerId, s]));
  const providerStats = providers.map((p) => {
    const stat = statsMap.get(p.id);
    const rate = stat && stat.total > 0 ? Math.round((stat.mentioned / stat.total) * 100) : null;
    return { id: p.id, displayName: p.displayName, rate };
  });

  // AI referrals
  const referralStats = await db
    .select({ platform: aiReferrals.referrerPlatform, count: sql<number>`count(*)::int` })
    .from(aiReferrals)
    .where(and(eq(aiReferrals.websiteId, websiteId), gte(aiReferrals.visitedAt, thirtyDaysAgo)))
    .groupBy(aiReferrals.referrerPlatform)
    .orderBy(desc(sql`count(*)`));

  // Recent citations
  const recentCitations = providerIds.length > 0
    ? await db
        .select({ citedUrl: aeoCitations.citedUrl, providerId: aeoCitations.providerId, scanDate: aeoCitations.scanDate })
        .from(aeoCitations)
        .where(and(eq(aeoCitations.websiteId, websiteId), gte(aeoCitations.scanDate, cutoff), eq(aeoCitations.isOwnDomain, true)))
        .orderBy(desc(aeoCitations.scanDate))
        .limit(10)
    : [];

  const citationsWithName = recentCitations.map((c) => ({
    ...c,
    scanDate: String(c.scanDate),
    providerName: providers.find((p) => p.id === c.providerId)?.displayName ?? "Unknown",
  }));

  // 30-day DVS trend
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const dvsHistory = await db
    .select({ scoredAt: dvsScores.scoredAt, seoScore: dvsScores.seoScore, aeoScore: dvsScores.aeoScore, compositeScore: dvsScores.compositeScore })
    .from(dvsScores)
    .where(and(eq(dvsScores.websiteId, websiteId), gte(dvsScores.scoredAt, cutoff30)))
    .orderBy(dvsScores.scoredAt);

  const trendData = dvsHistory.map((r) => ({
    date: r.scoredAt.toISOString().slice(0, 10),
    dvs: Math.round(r.compositeScore),
    seo: Math.round(r.seoScore),
    aeo: Math.round(r.aeoScore),
  }));

  // AEO sentiment breakdown (last 30 days)
  const sentimentRows = providerIds.length > 0
    ? await db
        .select({
          sentiment: aeoMentions.sentiment,
          count: sql<number>`count(*)::int`,
        })
        .from(aeoMentions)
        .where(and(
          eq(aeoMentions.websiteId, websiteId),
          inArray(aeoMentions.providerId, providerIds),
          gte(aeoMentions.scanDate, cutoff),
          eq(aeoMentions.brandMentioned, true),
        ))
        .groupBy(aeoMentions.sentiment)
    : [];

  const sentimentMap: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  for (const row of sentimentRows) {
    if (row.sentiment) sentimentMap[row.sentiment] = row.count;
  }
  const totalSentiment = sentimentMap.positive + sentimentMap.neutral + sentimentMap.negative;

  // AEO queries for this website
  const websiteQueries = await db
    .select({ id: aeoQueries.id, promptText: aeoQueries.promptText, active: aeoQueries.active })
    .from(aeoQueries)
    .where(eq(aeoQueries.websiteId, websiteId))
    .orderBy(aeoQueries.createdAt);

  // Recent scans (includes running/pending — used for history + in-progress detection)
  const recentScans = await db
    .select({ id: scans.id, status: scans.status, completedAt: scans.completedAt, startedAt: scans.startedAt })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), isNull(scans.deletedAt)))
    .orderBy(desc(scans.createdAt))
    .limit(5);

  const runningScan = recentScans.find((s) => s.status === "running" || s.status === "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard" className="mb-1 inline-block text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← All websites
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{site.name}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{site.url}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/${websiteId}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Download Report
          </a>
          <Link
            href={`/website/${websiteId}/cms`}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            CMS
          </Link>
          <Link href="/scan" className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Re-scan
          </Link>
        </div>
      </header>

      {runningScan && <ScanProgressBanner scanId={runningScan.id} />}

      {/* Score cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <ScoreCard label="DVS™" score={dvsScore} delta={dvsDelta} description="Digital Visibility Score" accent />
        <ScoreCard label="SEO" score={seoScore} delta={seoDelta} description="Search engine optimisation" />
        {aeoScanRunning ? (
          <div className="card-glow flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">AEO</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="text-sm text-muted-foreground">Analyzing…</span>
            </div>
          </div>
        ) : (
          <ScoreCard label="AEO" score={aeoScore} delta={aeoDelta} description="AI visibility score" />
        )}
      </div>

      {/* Trend chart */}
      <TrendChart data={trendData} />

      {/* Wins & warnings */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
          <p className="mb-3 text-xs font-medium text-green-400">Improvements</p>
          {seoDelta > 0 || aeoDelta > 0 || resolvedSinceLastScan > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {seoDelta > 0 && <li className="text-muted-foreground">SEO up <span className="font-medium text-green-400">+{seoDelta} pts</span></li>}
              {aeoDelta > 0 && <li className="text-muted-foreground">AEO up <span className="font-medium text-green-400">+{aeoDelta} pts</span></li>}
              {resolvedSinceLastScan > 0 && <li className="text-muted-foreground"><span className="font-medium text-green-400">{resolvedSinceLastScan}</span> issues resolved</li>}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Run another scan to track improvements.</p>
          )}
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="mb-3 text-xs font-medium text-red-400">Needs attention</p>
          {newCriticalCount > 0 || aeoDelta < -2 || seoDelta < -2 ? (
            <ul className="space-y-1.5 text-sm">
              {newCriticalCount > 0 && <li className="text-muted-foreground"><span className="font-medium text-red-400">{newCriticalCount}</span> critical issue type{newCriticalCount !== 1 ? "s" : ""}</li>}
              {seoDelta < -2 && <li className="text-muted-foreground">SEO dropped <span className="font-medium text-red-400">{seoDelta} pts</span></li>}
              {aeoDelta < -2 && <li className="text-muted-foreground">AEO dropped <span className="font-medium text-red-400">{aeoDelta} pts</span></li>}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">No significant drops detected.</p>
          )}
        </div>
      </div>

      {/* Priority SEO issues */}
      {topIssues.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Priority SEO Issues</h2>
            {latestScan && (
              <Link href={`/scan/${latestScan.id}/results`} className="text-xs text-primary hover:underline">
                Full audit →
              </Link>
            )}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {topIssues.map((issue) => (
              <div key={issue.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{issue.title}</p>
                  <p className="font-mono text-xs text-muted-foreground/60">{issue.type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <SeverityBadge severity={issue.severity} />
                  {issue.fixType && (
                    <Badge variant="outline" className={cn("text-xs",
                      issue.fixType === "quick"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    )}>
                      {issue.fixType === "quick" ? "Quick fix" : "Major fix"}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AEO mention rates */}
      {providerStats.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            AI Mention Rate
            <span className="ml-2 text-xs font-normal text-muted-foreground">last 30 days</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {providerStats.map((p) => (
              <div key={p.id} className="card-glow rounded-xl border border-border bg-card p-4">
                <p className="truncate text-xs text-muted-foreground">{p.displayName}</p>
                <p className={cn("mt-2 font-mono text-3xl font-bold tabular-nums",
                  p.rate !== null ? scoreColorClass(p.rate) : "text-muted-foreground"
                )}>
                  {aeoScanRunning ? <span className="animate-pulse text-sm text-muted-foreground">—</span> : p.rate !== null ? `${p.rate}%` : "—"}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AEO sentiment breakdown */}
      {totalSentiment > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            Sentiment Breakdown
            <span className="ml-2 text-xs font-normal text-muted-foreground">among mentions, last 30 days</span>
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {(["positive", "neutral", "negative"] as const).map((s) => {
              const count = sentimentMap[s];
              const pct = totalSentiment > 0 ? Math.round((count / totalSentiment) * 100) : 0;
              const colorClass = s === "positive" ? "text-green-400" : s === "negative" ? "text-red-400" : "text-yellow-400";
              const borderClass = s === "positive" ? "border-green-500/20 bg-green-500/5" : s === "negative" ? "border-red-500/20 bg-red-500/5" : "border-yellow-500/20 bg-yellow-500/5";
              return (
                <div key={s} className={`card-glow flex flex-col items-center rounded-xl border p-4 ${borderClass}`}>
                  <p className="text-xs font-medium capitalize text-muted-foreground">{s}</p>
                  <p className={`mt-2 font-mono text-3xl font-bold tabular-nums ${colorClass}`}>{pct}%</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{count} mention{count !== 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AEO queries */}
      {websiteQueries.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            AEO Queries
            <span className="ml-2 text-xs font-normal text-muted-foreground">{websiteQueries.filter(q => q.active).length} active</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
            {websiteQueries.map((q) => (
              <div key={q.id} className="flex items-start gap-3 px-4 py-3">
                <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", q.active ? "bg-emerald-400" : "bg-muted-foreground/30")} aria-hidden="true" />
                <p className="text-sm text-muted-foreground">{q.promptText}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI referral traffic */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">
          Real AI Traffic
          <span className="ml-2 text-xs font-normal text-muted-foreground">last 30 days</span>
        </h2>
        {referralStats.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">No AI referrals yet.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              <Link href="/aeo/setup" className="text-primary hover:underline">Install the tracking snippet →</Link>
              {" "}to capture real visits from ChatGPT, Perplexity, and more.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
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
                    <TableCell className="font-mono text-sm">{r.platform}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{r.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* Citations */}
      {citationsWithName.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">AI Citations</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Platform</TableHead>
                  <TableHead className="text-xs">Page cited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {citationsWithName.map((c, i) => (
                  <TableRow key={i} className="border-border align-top">
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.scanDate.slice(0, 10)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-primary/30 bg-primary/10 text-primary">
                        {c.providerName}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="truncate font-mono text-xs text-muted-foreground">{c.citedUrl}</p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}

      {/* Recent scans */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Scan History</h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
          {recentScans.map((s) => (
            <Link
              key={s.id}
              href={s.status === "completed" ? `/scan/${s.id}/results` : `/scan/${s.id}`}
              className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
            >
              <div>
                <p className="text-sm font-medium">{s.status === "completed" ? "Scan completed" : `Scan ${s.status}`}</p>
                <p className="text-xs text-muted-foreground">
                  {s.completedAt
                    ? <LocalTime date={s.completedAt} dateStyle="medium" timeStyle="short" />
                    : s.startedAt
                      ? <LocalTime date={s.startedAt} dateStyle="medium" />
                      : "—"}
                </p>
              </div>
              <ScanStatusBadge status={s.status} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreCard({ label, score, delta, description, accent }: {
  label: string; score: number; delta: number; description: string; accent?: boolean;
}) {
  return (
    <div className={cn("card-glow flex flex-col items-center justify-center rounded-xl border bg-card p-6",
      accent ? "border-primary/30" : "border-border"
    )}>
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn("mt-2 font-mono text-5xl font-bold tabular-nums", scoreColorClass(score))}>
        <CountUp to={score} />
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">/ 100</p>
      <p className={cn("mt-1 text-xs font-medium", scoreColorClass(score))}>{scoreGrade(score)}</p>
      {delta !== 0 && (
        <p className={cn("mt-2 text-xs font-medium", delta > 0 ? "text-green-400" : "text-red-400")}>
          {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} pts
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-400",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-400",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
      SEVERITY_STYLES[severity] ?? "border-border bg-muted text-muted-foreground"
    )}>
      {severity}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  running: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  pending: "text-muted-foreground bg-muted border-border",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
};

function ScanStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
      STATUS_STYLES[status] ?? STATUS_STYLES.pending
    )}>
      {status}
    </span>
  );
}

type TopIssue = { id: string; title: string; severity: string; fixType: string | null; type: string };
