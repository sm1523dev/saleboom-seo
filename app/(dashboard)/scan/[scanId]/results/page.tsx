import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues, aiSuggestions, changeSnapshots, cmsConnections, providerRequests } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore } from "@/lib/seo-score";
import { countByFixType } from "@/lib/fix-classifier";
import { ISSUE_TYPE_TO_FIELD } from "@/lib/fix-classifier";

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

  const [[website], [cmsConn]] = await Promise.all([
    db.select({ url: websites.url, name: websites.name })
      .from(websites).where(eq(websites.id, scan.websiteId)).limit(1),
    db.select({ id: cmsConnections.id })
      .from(cmsConnections).where(eq(cmsConnections.websiteId, scan.websiteId)).limit(1),
  ]);

  const allIssues = await db
    .select({
      id: issues.id,
      pageUrl: issues.pageUrl,
      type: issues.type,
      severity: issues.severity,
      title: issues.title,
      description: issues.description,
      fixType: issues.fixType,
      ignoredAt: issues.ignoredAt,
      resolvedAt: issues.resolvedAt,
    })
    .from(issues)
    .where(eq(issues.scanId, scanId))
    .orderBy(issues.severity, issues.type);

  const scanIssues = allIssues.filter((i) => !i.ignoredAt && !i.resolvedAt);
  const ignoredIssues = allIssues.filter((i) => !!i.ignoredAt && !i.resolvedAt);

  // Fetch changeSnapshot statuses for issues in this scan
  const issueIds = allIssues.map((i) => i.id);
  const issueSnapshots = issueIds.length > 0
    ? await db
        .select({ issueId: changeSnapshots.issueId, status: changeSnapshots.status })
        .from(changeSnapshots)
        .where(
          and(
            inArray(changeSnapshots.issueId, issueIds),
            inArray(changeSnapshots.status, ["pending", "applied"]),
          ),
        )
    : [];

  const queuedIssueIds = new Set(
    issueSnapshots.filter((s) => s.status === "pending").map((s) => s.issueId as string),
  );
  // Mutable — we add to it when cross-referencing applied page/field combos below
  const fixedIssueIds = new Set(
    issueSnapshots.filter((s) => s.status === "applied").map((s) => s.issueId as string),
  );

  // Cross-reference applied snapshots: if (pageUrl, field) was previously applied,
  // treat new scan issues for the same page+field as already fixed.
  const pageUrls = [...new Set(scanIssues.map((i) => i.pageUrl).filter(Boolean) as string[])];
  const appliedPageFields = new Set<string>();
  if (pageUrls.length > 0) {
    const appliedRows = await db
      .select({ pageUrl: changeSnapshots.pageUrl, fieldChanged: changeSnapshots.fieldChanged })
      .from(changeSnapshots)
      .where(
        and(
          inArray(changeSnapshots.pageUrl, pageUrls),
          eq(changeSnapshots.status, "applied"),
        ),
      );
    for (const r of appliedRows) {
      appliedPageFields.add(`${r.pageUrl}:${r.fieldChanged}`);
    }
  }

  // Auto-resolve new scan issues if their page+field was already applied
  for (const issue of scanIssues) {
    if (!issue.resolvedAt && issue.pageUrl) {
      const field = ISSUE_TYPE_TO_FIELD[issue.type];
      if (field && appliedPageFields.has(`${issue.pageUrl}:${field}`)) {
        fixedIssueIds.add(issue.id);
      }
    }
  }

  const activeIssues = scanIssues.filter((i) => !queuedIssueIds.has(i.id) && !fixedIssueIds.has(i.id));
  const score = computeSeoScore(activeIssues);
  const fixCounts = countByFixType(activeIssues);

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

  // Fetch existing "Connect with us" requests for major fix issues in this scan
  const majorIssueIds = allIssues.filter((i) => i.fixType === "major").map((i) => i.id);
  const existingRequestRows = majorIssueIds.length > 0
    ? await db
        .select({ issueId: providerRequests.issueId, createdAt: providerRequests.createdAt })
        .from(providerRequests)
        .where(and(inArray(providerRequests.issueId, majorIssueIds), eq(providerRequests.status, "pending")))
    : [];
  const majorFixRequests: Record<string, string> = {};
  for (const r of existingRequestRows) {
    if (r.issueId) majorFixRequests[r.issueId] = r.createdAt.toISOString();
  }

  return (
    <ResultsView
      scanId={scanId}
      websiteId={scan.websiteId}
      websiteName={website?.name ?? "Unknown"}
      websiteUrl={website?.url ?? ""}
      completedAt={scan.completedAt?.toISOString() ?? null}
      pagesScanned={scan.pagesScanned ?? null}
      totalPages={scan.totalPages ?? null}
      score={score}
      fixCounts={fixCounts}
      issues={scanIssues}
      ignoredIssues={ignoredIssues}
      queuedIssueIds={Array.from(queuedIssueIds)}
      fixedIssueIds={Array.from(fixedIssueIds)}
      suggestions={suggestions}
      pastSuggestions={pastSuggestions}
      approvedSnapshots={approvedSnapshots}
      cmsConnected={!!cmsConn}
      majorFixRequests={majorFixRequests}
    />
  );
}

