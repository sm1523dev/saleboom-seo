import type { Metadata } from "next";
import Link from "next/link";
import { eq, and, isNull, inArray, sql, desc, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, aeoMentions, aeoProviders, aeoScores, dvsScores } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore, scoreColorClass, scoreGrade } from "@/lib/seo-score";
import { computeDvsScore } from "@/lib/dvs/score";
import { StaggerChildren } from "@/components/animations/stagger-children";
import { TrendChart } from "@/components/shared/trend-chart";
import { CountUp } from "@/components/animations/count-up";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your Digital Visibility Score and key SEO & AEO metrics.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)));

  const websiteIds = userWebsites.map((w) => w.id);

  let seoScore = 0;
  let aeoScore = 0;
  let dvsScore = 0;
  let seoDelta = 0;
  let aeoDelta = 0;
  let dvsDelta = 0;
  let openIssueCount = 0;
  let resolvedSinceLastScan = 0;
  let newCriticalCount = 0;
  let topIssues: TopIssue[] = [];
  let recentScans: RecentScan[] = [];
  let aeoProviderStats: AeoProviderStat[] = [];
  let trendData: TrendPoint[] = [];
  let latestScanId: string | null = null;
  let aeoScanRunning = false;

  if (websiteIds.length > 0) {
    // Latest completed scans per website
    const completedScans = await db
      .select({ id: scans.id, websiteId: scans.websiteId, completedAt: scans.completedAt })
      .from(scans)
      .where(and(inArray(scans.websiteId, websiteIds), eq(scans.status, "completed"), isNull(scans.deletedAt)))
      .orderBy(desc(scans.completedAt));

    const latestPerSite = new Map<string, string>();
    for (const s of completedScans) {
      if (!latestPerSite.has(s.websiteId)) latestPerSite.set(s.websiteId, s.id);
    }
    const latestIds = [...latestPerSite.values()];
    latestScanId = latestIds[0] ?? null;

    // Previous scan per website (for deltas)
    const prevPerSite = new Map<string, string>();
    for (const s of completedScans) {
      if (latestPerSite.has(s.websiteId) && latestPerSite.get(s.websiteId) !== s.id && !prevPerSite.has(s.websiteId)) {
        prevPerSite.set(s.websiteId, s.id);
      }
    }
    const prevIds = [...prevPerSite.values()];

    if (latestIds.length > 0) {
      // Current SEO score
      const allSeverities = await db
        .select({ scanId: issues.scanId, type: issues.type, severity: issues.severity })
        .from(issues)
        .where(and(inArray(issues.scanId, latestIds), isNull(issues.resolvedAt)));
      const byScan = new Map<string, { type: string; severity: string }[]>();
      for (const r of allSeverities) {
        const arr = byScan.get(r.scanId) ?? [];
        arr.push({ type: r.type, severity: r.severity });
        byScan.set(r.scanId, arr);
      }
      const scores = latestIds.map((id) => computeSeoScore(byScan.get(id) ?? []));
      seoScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;

      // Open issues
      const [issueRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(and(inArray(issues.scanId, latestIds), isNull(issues.resolvedAt), isNull(issues.deletedAt)));
      openIssueCount = issueRow?.count ?? 0;

      // Top 3 critical/high issues — deduplicated by type (one entry per issue type)
      const allTopIssues = await db
        .select({ id: issues.id, title: issues.title, severity: issues.severity, fixType: issues.fixType, type: issues.type })
        .from(issues)
        .where(and(inArray(issues.scanId, latestIds), isNull(issues.resolvedAt), inArray(issues.severity, ["critical", "high"])))
        .orderBy(issues.severity);
      const seenTypes = new Set<string>();
      topIssues = allTopIssues.filter((i) => {
        if (seenTypes.has(i.type)) return false;
        seenTypes.add(i.type);
        return true;
      }).slice(0, 3);

      // SEO delta vs previous scan
      if (prevIds.length > 0) {
        const prevSeverities = await db
          .select({ scanId: issues.scanId, type: issues.type, severity: issues.severity })
          .from(issues)
          .where(and(inArray(issues.scanId, prevIds), isNull(issues.resolvedAt)));
        const prevByScan = new Map<string, { type: string; severity: string }[]>();
        for (const r of prevSeverities) {
          const arr = prevByScan.get(r.scanId) ?? [];
          arr.push({ type: r.type, severity: r.severity });
          prevByScan.set(r.scanId, arr);
        }
        const prevScores = prevIds.map((id) => computeSeoScore(prevByScan.get(id) ?? []));
        const prevSeo = prevScores.length > 0 ? Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length) : 100;
        seoDelta = seoScore - prevSeo;

        // Resolved since last scan
        const [resolvedRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(issues)
          .where(and(inArray(issues.scanId, prevIds), isNull(issues.deletedAt)));
        resolvedSinceLastScan = resolvedRow?.count ? Math.max(0, (resolvedRow.count) - openIssueCount) : 0;
      }

      // New critical issues (in latest but not prev)
      if (prevIds.length > 0) {
        const [newCritRow] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(issues)
          .where(and(inArray(issues.scanId, latestIds), eq(issues.severity, "critical"), isNull(issues.resolvedAt)));
        newCriticalCount = newCritRow?.count ?? 0;
      }
    }

    // AEO score (latest)
    const [latestAeo] = await db
      .select({ compositeScore: aeoScores.compositeScore, scoredAt: aeoScores.scoredAt })
      .from(aeoScores)
      .where(inArray(aeoScores.websiteId, websiteIds))
      .orderBy(desc(aeoScores.scoredAt))
      .limit(1);

    aeoScore = Math.round(latestAeo?.compositeScore ?? 0);

    // Check if AEO scan is running (no score in last 10 min = likely still running)
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    aeoScanRunning = !latestAeo || latestAeo.scoredAt < tenMinAgo;

    // AEO delta
    const aeoHistory = await db
      .select({ compositeScore: aeoScores.compositeScore })
      .from(aeoScores)
      .where(inArray(aeoScores.websiteId, websiteIds))
      .orderBy(desc(aeoScores.scoredAt))
      .limit(2);
    if (aeoHistory.length >= 2) {
      aeoDelta = Math.round(aeoHistory[0].compositeScore - aeoHistory[1].compositeScore);
    }

    // DVS score
    dvsScore = computeDvsScore(seoScore, aeoScore);
    const dvsHistory = await db
      .select({ compositeScore: dvsScores.compositeScore })
      .from(dvsScores)
      .where(inArray(dvsScores.websiteId, websiteIds))
      .orderBy(desc(dvsScores.scoredAt))
      .limit(2);
    if (dvsHistory.length >= 2) {
      dvsDelta = Math.round(dvsHistory[0].compositeScore - dvsHistory[1].compositeScore);
    }

    // AEO per-provider stats
    const providerRows = await db
      .select({ id: aeoProviders.id, displayName: aeoProviders.displayName })
      .from(aeoProviders)
      .where(eq(aeoProviders.enabled, true));

    if (providerRows.length > 0) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);
      const mentionStats = await db
        .select({
          providerId: aeoMentions.providerId,
          total: sql<number>`count(*)::int`,
          mentioned: sql<number>`count(*) filter (where ${aeoMentions.brandMentioned})::int`,
        })
        .from(aeoMentions)
        .where(and(
          inArray(aeoMentions.websiteId, websiteIds),
          inArray(aeoMentions.providerId, providerRows.map((p) => p.id)),
          gte(aeoMentions.scanDate, cutoff)
        ))
        .groupBy(aeoMentions.providerId);

      const statsMap = new Map(mentionStats.map((s) => [s.providerId, s]));
      aeoProviderStats = providerRows.map((p) => {
        const stat = statsMap.get(p.id);
        const rate = stat && stat.total > 0 ? Math.round((stat.mentioned / stat.total) * 100) : null;
        return { id: p.id, displayName: p.displayName, rate };
      });
    }

    // 30-day trend data
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const dvsRows = await db
      .select({ scoredAt: dvsScores.scoredAt, seoScore: dvsScores.seoScore, aeoScore: dvsScores.aeoScore, compositeScore: dvsScores.compositeScore })
      .from(dvsScores)
      .where(and(inArray(dvsScores.websiteId, websiteIds), gte(dvsScores.scoredAt, cutoff30)))
      .orderBy(dvsScores.scoredAt);

    trendData = dvsRows.map((r) => ({
      date: r.scoredAt.toISOString().slice(0, 10),
      dvs: Math.round(r.compositeScore),
      seo: Math.round(r.seoScore),
      aeo: Math.round(r.aeoScore),
    }));

    // Recent scans
    const recentScanRows = await db
      .select({ id: scans.id, websiteId: scans.websiteId, status: scans.status, completedAt: scans.completedAt, startedAt: scans.startedAt })
      .from(scans)
      .where(and(inArray(scans.websiteId, websiteIds), isNull(scans.deletedAt)))
      .orderBy(desc(scans.createdAt))
      .limit(5);

    const websiteMap = new Map(userWebsites.map((w) => [w.id, w]));
    recentScans = recentScanRows.map((s) => ({
      id: s.id,
      websiteName: websiteMap.get(s.websiteId)?.name ?? "Unknown",
      websiteUrl: websiteMap.get(s.websiteId)?.url ?? "",
      status: s.status,
      completedAt: s.completedAt?.toISOString() ?? null,
      startedAt: s.startedAt?.toISOString() ?? null,
    }));
  }

  const hasData = recentScans.length > 0;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your Digital Visibility Score</p>
        </div>
        <Link href="/scan" className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
          + New scan
        </Link>
      </header>

      {!hasData ? (
        <section className="card-glow rounded-xl border border-border bg-card p-12 text-center">
          <div className="animate-breathe mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
            <span className="text-xl text-primary">⊙</span>
          </div>
          <h2 className="font-semibold">No scan data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Run your first scan to see your Digital Visibility Score</p>
          <Link href="/scan" className="btn-press mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Start a scan →
          </Link>
        </section>
      ) : (
        <>
          {/* ── Hero: three scores ── */}
          <StaggerChildren className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ScoreCard label="DVS™" score={dvsScore} delta={dvsDelta} description="Digital Visibility Score" accent />
            <ScoreCard label="SEO" score={seoScore} delta={seoDelta} description="Search engine optimisation" />
            <AeoScoreCard score={aeoScore} delta={aeoDelta} running={aeoScanRunning} />
          </StaggerChildren>

          {/* ── Trend chart ── */}
          <TrendChart data={trendData} />

          {/* ── Wins & warnings ── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <p className="mb-3 text-xs font-medium text-green-400">Improvements</p>
              {resolvedSinceLastScan > 0 || seoDelta > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {seoDelta > 0 && <li className="text-muted-foreground">SEO score up <span className="font-medium text-green-400">+{seoDelta} pts</span> since last scan</li>}
                  {aeoDelta > 0 && <li className="text-muted-foreground">AEO score up <span className="font-medium text-green-400">+{aeoDelta} pts</span></li>}
                  {resolvedSinceLastScan > 0 && <li className="text-muted-foreground"><span className="font-medium text-green-400">{resolvedSinceLastScan}</span> issues resolved</li>}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Run another scan to track improvements over time.</p>
              )}
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
              <p className="mb-3 text-xs font-medium text-red-400">Needs attention</p>
              {newCriticalCount > 0 || aeoDelta < -2 ? (
                <ul className="space-y-1.5 text-sm">
                  {newCriticalCount > 0 && <li className="text-muted-foreground"><span className="font-medium text-red-400">{newCriticalCount}</span> critical issue{newCriticalCount !== 1 ? "s" : ""} detected</li>}
                  {aeoDelta < -2 && <li className="text-muted-foreground">AEO score dropped <span className="font-medium text-red-400">{aeoDelta} pts</span></li>}
                  {seoDelta < -2 && <li className="text-muted-foreground">SEO score dropped <span className="font-medium text-red-400">{seoDelta} pts</span></li>}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No significant drops detected.</p>
              )}
            </div>
          </div>

          {/* ── Priority issues ── */}
          {topIssues.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Priority Issues</h2>
                {latestScanId && (
                  <Link href={`/scan/${latestScanId}/results`} className="text-xs text-primary hover:underline">
                    View all →
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
                        <span className={cn("rounded-full border px-2 py-0.5 text-xs",
                          issue.fixType === "quick"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-muted text-muted-foreground"
                        )}>
                          {issue.fixType === "quick" ? "Quick fix" : "Major fix"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── AEO platform snapshot ── */}
          {aeoProviderStats.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">AI Mention Rate</h2>
                <Link href="/aeo" className="text-xs text-primary hover:underline">View AEO Intelligence →</Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {aeoProviderStats.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-card p-3">
                    <p className="truncate text-xs text-muted-foreground">{p.displayName}</p>
                    <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
                      {aeoScanRunning ? <span className="animate-pulse text-muted-foreground text-sm">—</span> : p.rate !== null ? `${p.rate}%` : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Recent scans ── */}
          <section>
            <h2 className="mb-3 text-sm font-semibold">Recent Scans</h2>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <ul role="list" className="divide-y divide-border">
                {recentScans.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={s.status === "completed" ? `/scan/${s.id}/results` : `/scan/${s.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s.websiteName}</p>
                        <p className="truncate text-xs text-muted-foreground">{s.websiteUrl}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        {s.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Intl.DateTimeFormat("en", { dateStyle: "short" }).format(new Date(s.completedAt))}
                          </span>
                        )}
                        <ScanStatusBadge status={s.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
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

function AeoScoreCard({ score, delta, running }: { score: number; delta: number; running: boolean }) {
  return (
    <div className="card-glow flex flex-col items-center justify-center rounded-xl border border-border bg-card p-6">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">AEO</p>
      {running ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm text-muted-foreground">Analyzing…</span>
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">AI visibility scan in progress</p>
        </>
      ) : (
        <>
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
          <Link href="/aeo" className="mt-2 text-xs text-primary hover:underline">View AEO Intelligence →</Link>
        </>
      )}
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
type RecentScan = { id: string; websiteName: string; websiteUrl: string; status: string; completedAt: string | null; startedAt: string | null };
type AeoProviderStat = { id: string; displayName: string; rate: number | null };
type TrendPoint = { date: string; dvs: number; seo: number; aeo: number };
