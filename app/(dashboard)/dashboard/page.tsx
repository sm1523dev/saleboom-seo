import type { Metadata } from "next";
import Link from "next/link";
import { eq, and, isNull, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, scans, issues, aeoScores, cmsConnections, changeSnapshots } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore } from "@/lib/seo-score";
import { computeDvsScore } from "@/lib/dvs/score";
import { AgencyTable } from "./_components/agency-table";
import { OnboardingChecklist } from "@/components/shared/onboarding-checklist";

export const metadata: Metadata = {
  title: "Overview",
  description: "All your connected websites and their Digital Visibility Scores.",
  robots: { index: false, follow: false },
};

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

export default async function DashboardPage() {
  const session = await getServerSession();

  const userWebsites = await db
    .select({ id: websites.id, name: websites.name, url: websites.url, createdAt: websites.createdAt })
    .from(websites)
    .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
    .orderBy(desc(websites.createdAt));

  const websiteIds = userWebsites.map((w) => w.id);

  const [websiteRows, completedScans, connectedCms, approvedFixes] = await Promise.all([
    Promise.all(
      userWebsites.map(async (site): Promise<WebsiteRow> => {
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
    ),
    // hasScan: any completed scan across all this user's websites
    websiteIds.length > 0
      ? db
          .select({ id: scans.id })
          .from(scans)
          .where(and(inArray(scans.websiteId, websiteIds), eq(scans.status, "completed"), isNull(scans.deletedAt)))
          .limit(1)
          .then((rows) => rows)
      : Promise.resolve([]),
    // hasCmsConnected: any CMS connection across this user's websites
    websiteIds.length > 0
      ? db
          .select({ id: cmsConnections.id })
          .from(cmsConnections)
          .innerJoin(websites, eq(websites.id, cmsConnections.websiteId))
          .where(and(eq(websites.userId, session.user.id), isNull(websites.deletedAt)))
          .limit(1)
          .then((rows) => rows)
      : Promise.resolve([]),
    // hasApprovedFix: any applied change snapshot for this user
    db
      .select({ id: changeSnapshots.id })
      .from(changeSnapshots)
      .where(and(eq(changeSnapshots.userId, session.user.id), eq(changeSnapshots.status, "applied")))
      .limit(1)
      .then((rows) => rows),
  ]);

  const hasWebsite = userWebsites.length > 0;
  const hasScan = completedScans.length > 0;
  const hasCmsConnected = connectedCms.length > 0;
  const hasApprovedFix = approvedFixes.length > 0;

  const firstWebsiteId = userWebsites[0]?.id;

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

      {!(hasWebsite && hasScan && hasCmsConnected && hasApprovedFix) && (
        <OnboardingChecklist
          hasWebsite={hasWebsite}
          hasScan={hasScan}
          hasCmsConnected={hasCmsConnected}
          hasApprovedFix={hasApprovedFix}
          firstWebsiteId={firstWebsiteId}
        />
      )}

      <AgencyTable websites={websiteRows} />
    </div>
  );
}
