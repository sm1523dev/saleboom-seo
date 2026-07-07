import type { ParsedPage, SiteContext, SeoIssue, PageRule } from "../types";

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    // Normalize trailing slash: remove it unless root
    if (u.pathname !== "/" && u.pathname.endsWith("/")) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.href;
  } catch {
    return url;
  }
}

const metaPageRules: PageRule[] = [
  // 1. Meta title missing
  (p) =>
    !p.title
      ? [
          {
            type: "meta-title-missing",
            severity: "critical",
            title: "Meta title missing",
            description: `${p.url} has no <title> tag. Search engines will auto-generate a title, which is usually suboptimal.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 2. Meta title too short
  (p) =>
    p.title && p.title.length < 30
      ? [
          {
            type: "meta-title-too-short",
            severity: "medium",
            title: "Meta title too short",
            description: `${p.url} has a title of ${p.title.length} characters (min 30). Short titles miss keyword opportunities.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 3. Meta title too long
  (p) =>
    p.title && p.title.length > 60
      ? [
          {
            type: "meta-title-too-long",
            severity: "low",
            title: "Meta title too long",
            description: `${p.url} has a title of ${p.title.length} characters (max 60). Google truncates titles beyond ~60 chars in SERPs.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 4. Meta description missing
  (p) =>
    !p.description
      ? [
          {
            type: "meta-description-missing",
            severity: "high",
            title: "Meta description missing",
            description: `${p.url} has no meta description. Descriptions are shown in search results and affect click-through rate.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 5. Meta description too short
  (p) =>
    p.description && p.description.length < 120
      ? [
          {
            type: "meta-description-too-short",
            severity: "medium",
            title: "Meta description too short",
            description: `${p.url} has a description of ${p.description.length} characters (min 120). Descriptions below 120 chars may display poorly in SERPs.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 6. Meta description too long
  (p) =>
    p.description && p.description.length > 160
      ? [
          {
            type: "meta-description-too-long",
            severity: "low",
            title: "Meta description too long",
            description: `${p.url} has a description of ${p.description.length} characters (max 160). Google truncates descriptions beyond ~160 chars in SERPs.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 7. H1 missing
  (p) =>
    p.h1s.length === 0
      ? [
          {
            type: "h1-missing",
            severity: "critical",
            title: "H1 heading missing",
            description: `${p.url} has no H1 tag. Every page should have exactly one H1 that describes the page topic.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 8. Multiple H1 tags
  (p) =>
    p.h1s.length > 1
      ? [
          {
            type: "h1-multiple",
            severity: "high",
            title: "Multiple H1 headings",
            description: `${p.url} has ${p.h1s.length} H1 tags. A page should have exactly one H1 to signal the primary topic.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 9. H1 too long
  (p) => {
    const issues: SeoIssue[] = [];
    for (const h1 of p.h1s) {
      if (h1.length > 70) {
        issues.push({
          type: "h1-too-long",
          severity: "low",
          title: "H1 heading too long",
          description: `${p.url} has an H1 of ${h1.length} characters (max 70). Keep H1s concise to reinforce your primary keyword.`,
          fixType: "quick",
          pageUrl: p.url,
        });
        break; // one issue per page
      }
    }
    return issues;
  },

  // 10. H1 matches meta title exactly (missed keyword diversification)
  (p) => {
    if (!p.title || p.h1s.length === 0) return [];
    const normalized = (s: string) => s.toLowerCase().trim();
    const match = p.h1s.some((h1) => normalized(h1) === normalized(p.title!));
    return match
      ? [
          {
            type: "h1-matches-title",
            severity: "info",
            title: "H1 is identical to meta title",
            description: `${p.url}: the H1 and meta title are identical. Consider varying them to target additional keywords or a more natural heading.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [];
  },

  // 11. Canonical tag missing
  (p) =>
    !p.canonical
      ? [
          {
            type: "canonical-missing",
            severity: "medium",
            title: "Canonical tag missing",
            description: `${p.url} has no <link rel="canonical"> tag. Without one, duplicate content may be indexed under multiple URLs.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 12. Canonical points to a different URL (self-reference mismatch)
  (p) => {
    if (!p.canonical) return [];
    const self = normalizeUrl(p.url);
    const canon = normalizeUrl(p.canonical);
    if (canon !== self) {
      return [
        {
          type: "canonical-self-mismatch",
          severity: "medium",
          title: "Canonical URL does not match page URL",
          description: `${p.url} has canonical pointing to ${p.canonical}. Verify this is intentional — it consolidates signals to the canonical target.`,
          fixType: "major",
          pageUrl: p.url,
        },
      ];
    }
    return [];
  },

  // 13. Open Graph title missing
  (p) =>
    !p.ogTitle
      ? [
          {
            type: "og-title-missing",
            severity: "medium",
            title: "Open Graph title missing",
            description: `${p.url} is missing <meta property="og:title">. Social platforms use OG tags to render link previews.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 14. Open Graph description missing
  (p) =>
    !p.ogDescription
      ? [
          {
            type: "og-description-missing",
            severity: "medium",
            title: "Open Graph description missing",
            description: `${p.url} is missing <meta property="og:description">. Without it, social platforms display a fallback snippet which may appear truncated.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 15. Open Graph image missing
  (p) =>
    !p.ogImage
      ? [
          {
            type: "og-image-missing",
            severity: "low",
            title: "Open Graph image missing",
            description: `${p.url} is missing <meta property="og:image">. Social shares without an image receive significantly fewer clicks.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 16. Twitter card missing
  (p) =>
    !p.twitterCard
      ? [
          {
            type: "twitter-card-missing",
            severity: "low",
            title: "Twitter card meta tag missing",
            description: `${p.url} is missing <meta name="twitter:card">. Twitter won't render a rich preview for this page when shared.`,
            fixType: "quick",
            pageUrl: p.url,
          },
        ]
      : [],

  // 17. Viewport meta missing
  (p) =>
    !p.viewport
      ? [
          {
            type: "viewport-missing",
            severity: "critical",
            title: "Viewport meta tag missing",
            description: `${p.url} has no <meta name="viewport"> tag. Pages without viewport configuration fail Google's mobile-friendly test and may rank lower on mobile.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 18. HTML lang attribute missing
  (p) =>
    !p.langAttr
      ? [
          {
            type: "lang-missing",
            severity: "medium",
            title: "HTML lang attribute missing",
            description: `${p.url} has no lang attribute on the <html> element. Screen readers and search engines use it to determine the page language.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 19. Charset meta missing
  (p) =>
    !p.charset
      ? [
          {
            type: "charset-missing",
            severity: "medium",
            title: "Charset declaration missing",
            description: `${p.url} has no <meta charset="..."> tag. Without a charset declaration, browsers may misinterpret character encoding, causing display issues.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 20. Page marked noindex
  (p) => {
    const robots = p.robotsMeta?.toLowerCase() ?? "";
    if (robots.includes("noindex")) {
      return [
        {
          type: "robots-noindex",
          severity: "high",
          title: "Page marked noindex",
          description: `${p.url} has <meta name="robots" content="noindex">. This page will not appear in search results — verify this is intentional.`,
          fixType: "major",
          pageUrl: p.url,
        },
      ];
    }
    return [];
  },
];

export function runMetaRules(
  pages: ParsedPage[],
  ctx: SiteContext
): SeoIssue[] {
  return metaPageRules.flatMap((rule) =>
    pages.flatMap((page) => rule(page, ctx))
  );
}
