type Severity = "critical" | "high" | "medium" | "low" | "info";

const PENALTY: Record<Severity, number> = {
  critical: 5,
  high: 3,
  medium: 1.5,
  low: 0.5,
  info: 0,
};

/**
 * Compute an SEO score (0–100) from a list of issue severities.
 * Each severity subtracts a fixed penalty; the score floors at 0.
 */
export function computeSeoScore(severities: (string | null)[]): number {
  const total = severities.reduce(
    (sum, s) => sum + (s ? ((PENALTY as Record<string, number>)[s] ?? 0) : 0),
    0
  );
  return Math.max(0, Math.round(100 - total));
}

/** Colour class for a given score (for use with Tailwind). */
export function scoreColorClass(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

/** Human-readable grade label. */
export function scoreGrade(score: number): "Excellent" | "Good" | "Needs work" | "Poor" {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Needs work";
  return "Poor";
}
