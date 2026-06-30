import type { Metadata } from "next";
import Link from "next/link";
import { eq, and, isNull, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, aeoMentions, aeoProviders } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore } from "@/lib/seo-score";
import { CountUp } from "@/components/animations/count-up";
import { StaggerChildren } from "@/components/animations/stagger-children";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your Digital Visibility Score and key SEO & AEO metrics.",
  robots: { index: false, follow: false },
};


export default async function DashboardPage() {
  const session = await getServerSession();

  // 1. User's websites
  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url })
    .from(websites)
    .where(
      and(eq(websites.userId, session.user.id), isNull(websites.deletedAt))
    );

  const websiteIds = userWebsites.map((w) => w.id);
  const siteCount = websiteIds.length;

  let seoScore = 0;
  let openIssueCount = 0;
  let aeoCount = 0;
  let recentScans: RecentScan[] = [];
  let hasData = false;

  if (websiteIds.length > 0) {
    // 2. Most recent completed scan per website
    const completedScans = await db
      .select({
        id: scans.id,
        websiteId: scans.websiteId,
        completedAt: scans.completedAt,
      })
      .from(scans)
      .where(
        and(
          inArray(scans.websiteId, websiteIds),
          eq(scans.status, "completed"),
          isNull(scans.deletedAt)
        )
      )
      .orderBy(desc(scans.completedAt));

    // Deduplicate to latest per website
    const latestPerSite = new Map<string, string>();
    for (const s of completedScans) {
      if (!latestPerSite.has(s.websiteId)) latestPerSite.set(s.websiteId, s.id);
    }
    const latestIds = [...latestPerSite.values()];
    hasData = latestIds.length > 0;

    if (latestIds.length > 0) {
      // 3. Open issues across all latest scans
      const [issueCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(issues)
        .where(
          and(
            inArray(issues.scanId, latestIds),
            isNull(issues.resolvedAt),
            isNull(issues.deletedAt)
          )
        );
      openIssueCount = issueCountRow?.count ?? 0;

      // 4. SEO score — average per-site score
      const allSeverities = await db
        .select({ scanId: issues.scanId, severity: issues.severity })
        .from(issues)
        .where(
          and(inArray(issues.scanId, latestIds), isNull(issues.resolvedAt))
        );

      // Group by scan, compute per-scan score, then average
      const byScan = new Map<string, string[]>();
      for (const row of allSeverities) {
        const arr = byScan.get(row.scanId) ?? [];
        arr.push(row.severity);
        byScan.set(row.scanId, arr);
      }
      const scores = latestIds.map((id) =>
        computeSeoScore(byScan.get(id) ?? [])
      );
      seoScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 100;
    }

    // 5. AEO mention count — brand_mentioned = true across all providers for this user's sites
    const [aeoRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(aeoMentions)
      .innerJoin(aeoProviders, eq(aeoMentions.providerId, aeoProviders.id))
      .where(
        and(
          inArray(aeoProviders.websiteId, websiteIds),
          eq(aeoMentions.brandMentioned, true),
        )
      );
    aeoCount = aeoRow?.count ?? 0;

    // 6. Recent scans list (last 5)
    const recentScanRows = await db
      .select({
        id: scans.id,
        websiteId: scans.websiteId,
        status: scans.status,
        completedAt: scans.completedAt,
        startedAt: scans.startedAt,
      })
      .from(scans)
      .where(
        and(inArray(scans.websiteId, websiteIds), isNull(scans.deletedAt))
      )
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

  const kpiCards = [
    {
      label: "SEO Score",
      value: seoScore,
      suffix: "/100",
      description: "Across all sites",
    },
    {
      label: "AEO Mentions",
      value: aeoCount,
      suffix: "",
      description: "AI engine citations",
    },
    {
      label: "Open Issues",
      value: openIssueCount,
      suffix: "",
      description: "Pending fixes",
    },
    {
      label: "Sites",
      value: siteCount,
      suffix: "",
      description: "Connected properties",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Digital Visibility Score and key metrics
        </p>
      </header>

      {/* KPI cards */}
      <section aria-label="Key performance indicators">
        <StaggerChildren className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {kpiCards.map((card) => (
            <div
              key={card.label}
              className="card-glow rounded-xl border border-border bg-card p-5"
            >
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="mt-1 font-mono text-3xl font-bold">
                <CountUp to={card.value} suffix={card.suffix} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {card.description}
              </p>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* Recent scans / empty state */}
      {hasData ? (
        <section aria-label="Recent scans">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Scans</h2>
            <Link
              href="/scan"
              className="text-sm text-primary hover:underline"
            >
              + New scan
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul role="list" className="divide-y divide-border">
              {recentScans.map((s) => (
                <li key={s.id}>
                  <Link
                    href={
                      s.status === "completed"
                        ? `/scan/${s.id}/results`
                        : `/scan/${s.id}`
                    }
                    className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.websiteName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {s.websiteUrl}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {s.completedAt && (
                        <span className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("en", {
                            dateStyle: "short",
                          }).format(new Date(s.completedAt))}
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
      ) : (
        <section
          aria-label="Get started"
          className="rounded-xl border border-border bg-card p-12 text-center"
        >
          <div
            className="animate-breathe mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
            aria-hidden="true"
          >
            <span className="text-xl text-primary">⊙</span>
          </div>
          <h2 className="font-semibold">No scan data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Run your first scan to see your Digital Visibility Score
          </p>
          <Link
            href="/scan"
            className="btn-press mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Start a scan →
          </Link>
        </section>
      )}
    </div>
  );
}

type RecentScan = {
  id: string;
  websiteName: string;
  websiteUrl: string;
  status: string;
  completedAt: string | null;
  startedAt: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  completed: "text-green-400 bg-green-400/10 border-green-400/30",
  running: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  pending: "text-muted-foreground bg-muted border-border",
  failed: "text-red-400 bg-red-400/10 border-red-400/30",
};

function ScanStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status] ?? STATUS_STYLES.pending}`}
    >
      {status}
    </span>
  );
}
