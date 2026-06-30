type Severity = "critical" | "high" | "medium" | "low" | "info";

const PENALTY: Record<Severity, number> = {
  critical: 5,
  high: 3,
  medium: 1.5,
  low: 0.5,
  info: 0,
};

/**
 * Compute an SEO score (0–100) from site issues.
 *
 * Deduplicates by issue type before applying penalties — "missing H1 on
 * 50 pages" is one structural problem, not 50 independent deductions.
 * This keeps the score meaningful for large multi-page sites.
 */
export function computeSeoScore(
  issues: { type: string; severity: string | null }[]
): number {
  // One penalty per unique issue type, using the worst severity seen for that type
  const worstBySeverityRank: Record<string, number> = {
    critical: 4, high: 3, medium: 2, low: 1, info: 0,
  };
  const worstByType = new Map<string, string>();
  for (const { type, severity } of issues) {
    if (!severity) continue;
    const existing = worstByType.get(type);
    if (
      !existing ||
      (worstBySeverityRank[severity] ?? 0) > (worstBySeverityRank[existing] ?? 0)
    ) {
      worstByType.set(type, severity);
    }
  }
  const total = Array.from(worstByType.values()).reduce(
    (sum, s) => sum + ((PENALTY as Record<string, number>)[s] ?? 0),
    0
  );
  return Math.max(0, Math.round(100 - total));
}

export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

export function scoreGrade(score: number): "Excellent" | "Good" | "Needs work" | "Poor" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs work";
  return "Poor";
}
