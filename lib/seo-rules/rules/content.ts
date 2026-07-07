import type { ParsedPage, SiteContext, SeoIssue, PageRule } from "../types";

const contentPageRules: PageRule[] = [
  // 21. Images missing alt attribute entirely
  (p) => {
    const missing = p.images.filter((img) => img.alt === null);
    if (missing.length === 0) return [];
    return [
      {
        type: "images-missing-alt",
        severity: "high",
        title: "Images missing alt text",
        description: `${p.url} has ${missing.length} image${missing.length > 1 ? "s" : ""} with no alt attribute. Alt text is required for screen readers and helps search engines understand image content.`,
        fixType: "quick",
        pageUrl: p.url,
      },
    ];
  },

  // 22. Images with empty alt on non-decorative images (has meaningful src path)
  (p) => {
    const suspicious = p.images.filter((img) => {
      if (img.alt !== "") return false; // only empty string alt (not null, not text)
      const src = img.src.toLowerCase();
      // Flag empty alt when the filename looks like real content (not icon/spacer/bg)
      const looksDecorative = /spacer|blank|pixel|dot\.(gif|png)|1x1|bg[-_]/i.test(src);
      return !looksDecorative && src.length > 0;
    });
    if (suspicious.length === 0) return [];
    return [
      {
        type: "images-empty-alt",
        severity: "medium",
        title: "Images with empty alt text",
        description: `${p.url} has ${suspicious.length} non-decorative image${suspicious.length > 1 ? "s" : ""} with empty alt="". Add descriptive alt text for content images.`,
        fixType: "quick",
        pageUrl: p.url,
      },
    ];
  },

  // 23. Images missing width/height attributes (causes CLS)
  (p) => {
    const missing = p.images.filter(
      (img) => !img.hasWidthHeight && img.src.length > 0
    );
    if (missing.length === 0) return [];
    return [
      {
        type: "images-missing-dimensions",
        severity: "medium",
        title: "Images missing width/height attributes",
        description: `${p.url} has ${missing.length} image${missing.length > 1 ? "s" : ""} without explicit width and height. This causes Cumulative Layout Shift (CLS), hurting Core Web Vitals scores.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 24. Thin content
  (p) =>
    p.wordCount > 0 && p.wordCount < 300
      ? [
          {
            type: "thin-content",
            severity: "medium",
            title: "Thin content",
            description: `${p.url} has only ${p.wordCount} words (min 300). Pages with minimal content are less likely to rank and may be devalued by search engines.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 25. No internal links
  (p) =>
    p.internalLinks.length === 0
      ? [
          {
            type: "no-internal-links",
            severity: "medium",
            title: "No internal links",
            description: `${p.url} has no internal links. Internal links distribute PageRank and help search engines discover related pages.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 26. Too many links on a single page
  (p) => {
    const total = p.internalLinks.length + p.externalLinks.length;
    return total > 100
      ? [
          {
            type: "too-many-links",
            severity: "low",
            title: "Too many links on page",
            description: `${p.url} has ${total} links (max recommended 100). Excessive links dilute PageRank and may look spammy to crawlers.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [];
  },

  // 27. Heading hierarchy skips a level (e.g. H1 → H3 without H2)
  (p) => {
    if (p.h1s.length === 0) return []; // caught by h1-missing
    if (p.h2s.length > 0) return []; // normal H1 → H2 chain exists
    if (p.h3s.length === 0) return []; // only H1, no deeper headings — fine
    return [
      {
        type: "heading-hierarchy-skip",
        severity: "medium",
        title: "Heading hierarchy skips H2",
        description: `${p.url} has H1 and H3 headings but no H2. Heading levels must not skip — add H2 sections between H1 and H3.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 28. No H2 headings on content-heavy pages
  (p) => {
    if (p.wordCount < 600 || p.h2s.length > 0) return [];
    return [
      {
        type: "no-h2-headings",
        severity: "low",
        title: "No H2 subheadings on long page",
        description: `${p.url} has ${p.wordCount} words but no H2 subheadings. Long pages should use H2s to structure content and signal topic coverage to search engines.`,
        fixType: "major",
        pageUrl: p.url,
      },
    ];
  },

  // 29. target="_blank" links without rel="noopener"
  (p) =>
    p.blankTargetLinksNoRel.length > 0
      ? [
          {
            type: "blank-target-no-noopener",
            severity: "medium",
            title: "External links open in new tab without noopener",
            description: `${p.url} has ${p.blankTargetLinksNoRel.length} link${p.blankTargetLinksNoRel.length > 1 ? "s" : ""} with target="_blank" but no rel="noopener noreferrer". This exposes users to reverse tabnapping attacks.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],

  // 30. Mixed content detected
  (p) =>
    p.mixedContentSrcs.length > 0
      ? [
          {
            type: "mixed-content",
            severity: "high",
            title: "Mixed content (HTTP resources on HTTPS page)",
            description: `${p.url} loads ${p.mixedContentSrcs.length} resource${p.mixedContentSrcs.length > 1 ? "s" : ""} over HTTP while the page is served over HTTPS. Browsers block or warn about mixed content.`,
            fixType: "major",
            pageUrl: p.url,
          },
        ]
      : [],
];

// Site-level: broken internal links (pages linked to but returning 4xx)
function brokenInternalLinksRule(ctx: SiteContext): SeoIssue[] {
  const statusMap = new Map(ctx.pages.map((p) => [p.url, p.statusCode]));
  const issues: SeoIssue[] = [];

  for (const page of ctx.pages) {
    const broken = page.internalLinks.filter((href) => {
      const code = statusMap.get(href);
      return code !== undefined && code >= 400;
    });
    if (broken.length > 0) {
      issues.push({
        type: "broken-internal-links",
        severity: "high",
        title: "Broken internal links",
        description: `${page.url} links to ${broken.length} page${broken.length > 1 ? "s" : ""} returning 4xx errors: ${broken.slice(0, 3).join(", ")}${broken.length > 3 ? "…" : ""}. Fix or remove broken links to preserve crawl budget.`,
        fixType: "major",
        pageUrl: page.url,
      });
    }
  }
  return issues;
}

export function runContentRules(
  pages: ParsedPage[],
  ctx: SiteContext
): SeoIssue[] {
  return [
    ...contentPageRules.flatMap((rule) =>
      pages.flatMap((page) => rule(page, ctx))
    ),
    ...brokenInternalLinksRule(ctx),
  ];
}
