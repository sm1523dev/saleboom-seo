import { eq, and, desc, inArray, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, issues, aeoScores, dvsScores } from "@/lib/db/schema";
import { computeSeoScore } from "@/lib/seo-score";

// DVS™ = SEO×0.65 + AEO×0.35
// (Perf weight absorbed into SEO until performance metrics are built)
export function computeDvsScore(seoScore: number, aeoScore: number): number {
  return Math.round(seoScore * 0.65 + aeoScore * 0.35);
}

export async function persistDvsScore(websiteId: string): Promise<number> {
  // Get latest completed SEO score
  const [latestScan] = await db
    .select({ id: scans.id })
    .from(scans)
    .where(and(eq(scans.websiteId, websiteId), eq(scans.status, "completed")))
    .orderBy(desc(scans.completedAt))
    .limit(1);

  let seoScore = 0;
  if (latestScan) {
    // Exclude issues already resolved via CMS push — the penalty is gone,
    // no need to wait for the next scan to reflect it in the score.
    const scanIssues = await db
      .select({ type: issues.type, severity: issues.severity })
      .from(issues)
      .where(and(eq(issues.scanId, latestScan.id), isNull(issues.resolvedAt)));
    seoScore = computeSeoScore(scanIssues);
  }

  // Get latest AEO score
  const [latestAeo] = await db
    .select({ compositeScore: aeoScores.compositeScore })
    .from(aeoScores)
    .where(eq(aeoScores.websiteId, websiteId))
    .orderBy(desc(aeoScores.scoredAt))
    .limit(1);

  const aeoScore = latestAeo?.compositeScore ?? 0;
  const composite = computeDvsScore(seoScore, aeoScore);

  await db.insert(dvsScores).values({
    websiteId,
    scoredAt: new Date(),
    seoScore,
    aeoScore,
    compositeScore: composite,
  });

  return composite;
}

export async function getDvsHistory(
  websiteIds: string[],
  days = 30
): Promise<{ scoredAt: Date; seoScore: number; aeoScore: number; compositeScore: number }[]> {
  if (websiteIds.length === 0) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return db
    .select({
      scoredAt: dvsScores.scoredAt,
      seoScore: dvsScores.seoScore,
      aeoScore: dvsScores.aeoScore,
      compositeScore: dvsScores.compositeScore,
    })
    .from(dvsScores)
    .where(and(inArray(dvsScores.websiteId, websiteIds), gte(dvsScores.scoredAt, cutoff)))
    .orderBy(dvsScores.scoredAt);
}
