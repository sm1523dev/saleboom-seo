import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { computeSeoScore } from "@/lib/seo-score";
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

  const scanIssues = await db
    .select({
      id: issues.id,
      type: issues.type,
      severity: issues.severity,
      title: issues.title,
      description: issues.description,
      fixType: issues.fixType,
    })
    .from(issues)
    .where(eq(issues.scanId, scanId))
    .orderBy(issues.severity, issues.type);

  const score = computeSeoScore(scanIssues.map((i) => i.severity));

  return (
    <ResultsView
      scanId={scanId}
      websiteName={website?.name ?? "Unknown"}
      websiteUrl={website?.url ?? ""}
      completedAt={scan.completedAt?.toISOString() ?? null}
      score={score}
      issues={scanIssues}
    />
  );
}

