import type { ParsedPage, SiteContext, SeoIssue, PageRule } from "../types";

// Core Web Vitals thresholds (Google's "poor" tier)
const LCP_POOR_THRESHOLD = 4; // seconds
const CLS_POOR_THRESHOLD = 0.25;
const FCP_SLOW_THRESHOLD = 3; // seconds

const performancePageRules: PageRule[] = [
  // 43. Poor LCP (Largest Contentful Paint)
  (p) => {
    const lcp = p.cwv?.lcp;
    if (lcp === undefined || lcp <= LCP_POOR_THRESHOLD) return [];
    return [
      {
        type: "lcp-poor",
        severity: "high",
        title: "Poor Largest Contentful Paint (LCP)",
        description: `${p.url} has LCP of ${lcp.toFixed(1)}s (threshold ${LCP_POOR_THRESHOLD}s). Slow LCP is a direct Core Web Vitals failure and affects Google ranking.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 44. Poor CLS (Cumulative Layout Shift)
  (p) => {
    const cls = p.cwv?.cls;
    if (cls === undefined || cls <= CLS_POOR_THRESHOLD) return [];
    return [
      {
        type: "cls-poor",
        severity: "high",
        title: "Poor Cumulative Layout Shift (CLS)",
        description: `${p.url} has CLS score of ${cls.toFixed(3)} (threshold ${CLS_POOR_THRESHOLD}). High CLS means the page shifts visually as it loads, which Google penalizes.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 45. Slow FCP (First Contentful Paint)
  (p) => {
    const fcp = p.cwv?.fcp;
    if (fcp === undefined || fcp <= FCP_SLOW_THRESHOLD) return [];
    return [
      {
        type: "fcp-slow",
        severity: "medium",
        title: "Slow First Contentful Paint (FCP)",
        description: `${p.url} has FCP of ${fcp.toFixed(1)}s (threshold ${FCP_SLOW_THRESHOLD}s). Slow FCP degrades perceived performance and contributes to Core Web Vitals failure.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },
];

export function runPerformanceRules(
  pages: ParsedPage[],
  ctx: SiteContext
): SeoIssue[] {
  return performancePageRules.flatMap((rule) =>
    pages.flatMap((page) => rule(page, ctx))
  );
}
