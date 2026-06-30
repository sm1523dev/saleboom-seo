import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and, isNull, inArray, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, aeoScores, dvsScores } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore, scoreColorClass } from "@/lib/seo-score";
import { computeDvsScore } from "@/lib/dvs/score";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Overview",
  description: "All your connected websites and their Digital Visibility Scores.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url, createdAt: websites.createdAt })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .orderBy(desc(websites.createdAt));

  // Single website — skip portfolio, go straight to website detail
  if (userWebsites.length === 1) {
    redirect(`/website/${userWebsites[0].id}`);
  }

  const websiteIds = userWebsites.map((w) => w.id);

  const websiteRows: WebsiteRow[] = await Promise.all(
    userWebsites.map(async (site) => {
      const [latestScan] = await db
        .select({ id: scans.id, completedAt: scans.completedAt, status: scans.status })
        .from(scans)
        .where(and(eq(scans.websiteId, site.id), eq(scans.status, "completed"), isNull(scans.deletedAt)))
        .orderBy(desc(scans.completedAt))
        .limit(1);

      let seoScore: number | null = null;
      let openIssues = 0;

      if (latestScan) {
        const scanIssues = await db
          .select({ type: issues.type, severity: issues.severity })
          .from(issues)
          .where(and(eq(issues.scanId, latestScan.id), isNull(issues.resolvedAt)));
        seoScore = computeSeoScore(scanIssues);
        openIssues = scanIssues.length;
      }

      const [latestAeo] = await db
        .select({ compositeScore: aeoScores.compositeScore })
        .from(aeoScores)
        .where(eq(aeoScores.websiteId, site.id))
        .orderBy(desc(aeoScores.scoredAt))
        .limit(1);

      const aeoScore = latestAeo ? Math.round(latestAeo.compositeScore) : null;
      const dvsScore =
        seoScore !== null && aeoScore !== null
          ? computeDvsScore(seoScore, aeoScore)
          : seoScore !== null
            ? Math.round(seoScore * 0.65)
            : null;

      return {
        id: site.id,
        name: site.name,
        url: site.url,
        seoScore,
        aeoScore,
        dvsScore,
        openIssues,
        lastScanAt: latestScan?.completedAt?.toISOString() ?? null,
        lastScanId: latestScan?.id ?? null,
      };
    })
  );

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {websiteRows.length === 0
              ? "No websites scanned yet"
              : `${websiteRows.length} website${websiteRows.length !== 1 ? "s" : ""} tracked`}
          </p>
        </div>
        <Link
          href="/scan"
          className="btn-press rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + New scan
        </Link>
      </header>

      {websiteRows.length === 0 ? (
        <section className="card-glow rounded-xl border border-border bg-card p-12 text-center">
          <div className="animate-breathe mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10" aria-hidden="true">
            <span className="text-xl text-primary">⊙</span>
          </div>
          <h2 className="font-semibold">No websites yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">Scan your first website to see your Digital Visibility Score</p>
          <Link href="/scan" className="btn-press mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Start a scan →
          </Link>
        </section>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-left font-medium">Website</th>
                <th className="px-4 py-3 text-center font-medium">DVS™</th>
                <th className="px-4 py-3 text-center font-medium">SEO</th>
                <th className="px-4 py-3 text-center font-medium">AEO</th>
                <th className="px-4 py-3 text-center font-medium">Issues</th>
                <th className="px-4 py-3 text-left font-medium">Last scan</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {websiteRows.map((row) => (
                <tr key={row.id} className="group hover:bg-accent/50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-medium">{row.name}</p>
                    <p className="font-mono text-xs text-muted-foreground truncate max-w-[180px]">{row.url}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ScorePill score={row.dvsScore} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ScorePill score={row.seoScore} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    <ScorePill score={row.aeoScore} />
                  </td>
                  <td className="px-4 py-4 text-center">
                    {row.openIssues > 0 ? (
                      <span className="font-mono text-sm">{row.openIssues}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">
                    {row.lastScanAt
                      ? new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(row.lastScanAt))
                      : <span className="italic">Never</span>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/website/${row.id}`}
                      className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("font-mono font-bold tabular-nums", scoreColorClass(score))}>
      {score}
    </span>
  );
}

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
