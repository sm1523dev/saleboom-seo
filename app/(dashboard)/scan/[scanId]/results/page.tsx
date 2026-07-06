import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues, aiSuggestions } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore } from "@/lib/seo-score";
import { countByFixType } from "@/lib/fix-classifier";
import { isNotNull, inArray } from "drizzle-orm";
import { changeSnapshots } from "@/lib/db/schema";

import { ResultsView } from "./_components/results-view";

export const metadata: Metadata = {
  title: "Audit Results",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ scanId: string }>;
};

export default async function AuditResultsPage({ params }: Props) {
  const { scanId } = await params;
  await getServerSession();

  const [scan] = await db
    .select({
      id: scans.id,
      status: scans.status,
      websiteId: scans.websiteId,
      completedAt: scans.completedAt,
      pagesScanned: scans.pagesScanned,
      totalPages: scans.totalPages,
    })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!scan) notFound();
  if (scan.status !== "completed") {
    return (
      <div className="flex flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Results</h1>
        </header>
        <div className="card-glow rounded-xl border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">
            Scan is not yet complete.{" "}
            <a
              href={`/scan/${scanId}`}
              className="text-primary hover:underline"
            >
              Check scan status →
            </a>
          </p>
        </div>
      </div>
    );
  }

  const [website] = await db
    .select({ url: websites.url, name: websites.name })
    .from(websites)
    .where(eq(websites.id, scan.websiteId))
    .limit(1);

  const allIssues = await db
    .select({
      id: issues.id,
      type: issues.type,
      severity: issues.severity,
      title: issues.title,
      description: issues.description,
      fixType: issues.fixType,
      ignoredAt: issues.ignoredAt,
    })
    .from(issues)
    .where(eq(issues.scanId, scanId))
    .orderBy(issues.severity, issues.type);

  const scanIssues = allIssues.filter((i) => !i.ignoredAt);
  const ignoredIssues = allIssues.filter((i) => !!i.ignoredAt);

  const score = computeSeoScore(scanIssues);
  const fixCounts = countByFixType(scanIssues);

  const allSuggestions = await db
    .select({
      id: aiSuggestions.id,
      pageUrl: aiSuggestions.pageUrl,
      status: aiSuggestions.status,
      currentMetaTitle: aiSuggestions.currentMetaTitle,
      currentMetaDescription: aiSuggestions.currentMetaDescription,
      currentH1: aiSuggestions.currentH1,
      metaTitle: aiSuggestions.metaTitle,
      metaDescription: aiSuggestions.metaDescription,
      h1: aiSuggestions.h1,
    })
    .from(aiSuggestions)
    .where(eq(aiSuggestions.scanId, scanId));

  const suggestions = allSuggestions.filter((s) => s.status === "pending");
  const pastSuggestions = allSuggestions.filter((s) => s.status !== "pending");

  // Fetch existing pending change_snapshots so the UI reflects already-approved fields on refresh
  const approvedSnapshots =
    suggestions.length > 0
      ? await db
          .select({
            suggestionId: changeSnapshots.suggestionId,
            fieldChanged: changeSnapshots.fieldChanged,
            snapshotId: changeSnapshots.id,
          })
          .from(changeSnapshots)
          .where(
            and(
              inArray(
                changeSnapshots.suggestionId,
                suggestions.map((s) => s.id),
              ),
              eq(changeSnapshots.status, "pending"),
            ),
          )
      : [];

  return (
    <ResultsView
      scanId={scanId}
      websiteName={website?.name ?? "Unknown"}
      websiteUrl={website?.url ?? ""}
      completedAt={scan.completedAt?.toISOString() ?? null}
      pagesScanned={scan.pagesScanned ?? null}
      totalPages={scan.totalPages ?? null}
      score={score}
      fixCounts={fixCounts}
      issues={scanIssues}
      ignoredIssues={ignoredIssues}
      suggestions={suggestions}
      pastSuggestions={pastSuggestions}
      approvedSnapshots={approvedSnapshots}
    />
  );
}

