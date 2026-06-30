import type { SeoIssue } from "@/lib/seo-rules";

/**
 * Quick Fix — AI can generate and apply the change in one click.
 * The fix is a text field update (meta title, description, H1, alt tag, etc.)
 * with a clear right answer derivable from the page content.
 *
 * Major Fix — requires human judgment or structural site changes.
 * Examples: adding structured data, fixing redirect chains, HTTPS migration.
 */

const QUICK_FIX_TYPES = new Set([
  "meta-title-missing",
  "meta-title-too-short",
  "meta-title-too-long",
  "meta-description-missing",
  "meta-description-too-short",
  "meta-description-too-long",
  "h1-missing",
  "h1-too-long",
  "og-title-missing",
  "og-description-missing",
  "og-image-missing",
  "twitter-card-missing",
  "images-missing-alt",
  "images-empty-alt",
  "lang-missing",
  "charset-missing",
]);

export type FixType = "quick" | "major";

export function classifyFix(issueType: string): FixType {
  return QUICK_FIX_TYPES.has(issueType) ? "quick" : "major";
}

export function classifyIssues(issues: SeoIssue[]): SeoIssue[] {
  return issues.map((issue) => ({
    ...issue,
    fixType: issue.fixType ?? classifyFix(issue.type),
  }));
}

export function countByFixType(issues: { fixType: string | null }[]): {
  quick: number;
  major: number;
} {
  return issues.reduce(
    (acc, i) => {
      if (i.fixType === "quick") acc.quick++;
      else acc.major++;
      return acc;
    },
    { quick: 0, major: 0 }
  );
}
