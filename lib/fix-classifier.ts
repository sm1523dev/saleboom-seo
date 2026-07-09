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
  // Meta — AI generates and Yoast/CMS pushes
  "meta-title-missing",
  "meta-title-too-short",
  "meta-title-too-long",
  "meta-description-missing",
  "meta-description-too-short",
  "meta-description-too-long",
  "h1-missing",
  "h1-too-long",
  // Open Graph — Yoast sets og: from meta title/desc when pushed
  "og-title-missing",
  "og-description-missing",
  "twitter-card-missing",
  // Images — AI generates alt text from context
  "images-missing-alt",
  "images-empty-alt",
  // og-image-missing → needs image URL, Major Fix
  // lang-missing → HTML tag attribute, theme-level, Major Fix
  // charset-missing → HTML tag attribute, theme-level, Major Fix
]);

export type FixType = "quick" | "major";

// Maps issue type → the CMS field that fixing it would change.
// Used to cross-reference applied snapshots when suppressing already-fixed issues.
export const ISSUE_TYPE_TO_FIELD: Record<string, "meta_title" | "meta_description" | "h1"> = {
  "meta-title-missing": "meta_title",
  "meta-title-too-short": "meta_title",
  "meta-title-too-long": "meta_title",
  "og-title-missing": "meta_title",
  "twitter-card-missing": "meta_title",
  "canonical-missing": "meta_title",
  "duplicate-meta-title": "meta_title",
  "duplicate-og-title": "meta_title",
  "h1-title-identical-sitewide": "meta_title",
  "meta-description-missing": "meta_description",
  "meta-description-too-short": "meta_description",
  "meta-description-too-long": "meta_description",
  "og-description-missing": "meta_description",
  "duplicate-meta-description": "meta_description",
  "h1-missing": "h1",
  "h1-too-long": "h1",
  "h1-matches-title": "h1",
  "duplicate-h1": "h1",
  "images-missing-alt": "h1",
  "images-empty-alt": "h1",
};

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
