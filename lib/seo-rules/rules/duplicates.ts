import type { SiteContext, SeoIssue, SiteRule } from "../types";

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

function formatDuplicatePages(urls: string[]): string {
  const shown = urls.slice(0, 3);
  const suffix = urls.length > 3 ? ` and ${urls.length - 3} more` : "";
  return shown.join(", ") + suffix;
}

// 38. Duplicate meta titles
const duplicateTitlesRule: SiteRule = (ctx) => {
  const pagesWithTitle = ctx.pages.filter((p) => p.title);
  const groups = groupBy(pagesWithTitle, (p) =>
    p.title!.toLowerCase().trim()
  );
  const issues: SeoIssue[] = [];

  for (const [title, pages] of groups) {
    if (pages.length < 2) continue;
    const urls = pages.map((p) => p.url);
    issues.push({
      type: "duplicate-meta-title",
      severity: "high",
      title: "Duplicate meta title",
      description: `${pages.length} pages share the title "${title.slice(0, 60)}${title.length > 60 ? "…" : ""}": ${formatDuplicatePages(urls)}. Each page needs a unique title for proper indexing.`,
      fixType: "quick",
    });
  }
  return issues;
};

// 39. Duplicate meta descriptions
const duplicateDescriptionsRule: SiteRule = (ctx) => {
  const pagesWithDesc = ctx.pages.filter((p) => p.description);
  const groups = groupBy(pagesWithDesc, (p) =>
    p.description!.toLowerCase().trim()
  );
  const issues: SeoIssue[] = [];

  for (const [desc, pages] of groups) {
    if (pages.length < 2) continue;
    const urls = pages.map((p) => p.url);
    issues.push({
      type: "duplicate-meta-description",
      severity: "high",
      title: "Duplicate meta description",
      description: `${pages.length} pages share the same description "${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}": ${formatDuplicatePages(urls)}. Unique descriptions improve click-through rate.`,
      fixType: "quick",
    });
  }
  return issues;
};

// 40. Duplicate H1 headings
const duplicateH1Rule: SiteRule = (ctx) => {
  const pagesWithH1 = ctx.pages.filter((p) => p.h1s.length > 0);
  const groups = groupBy(pagesWithH1, (p) =>
    p.h1s[0].toLowerCase().trim()
  );
  const issues: SeoIssue[] = [];

  for (const [h1, pages] of groups) {
    if (pages.length < 2) continue;
    const urls = pages.map((p) => p.url);
    issues.push({
      type: "duplicate-h1",
      severity: "medium",
      title: "Duplicate H1 heading",
      description: `${pages.length} pages share the H1 "${h1.slice(0, 60)}${h1.length > 60 ? "…" : ""}": ${formatDuplicatePages(urls)}. Unique H1s help search engines understand each page's distinct focus.`,
      fixType: "quick",
    });
  }
  return issues;
};

// 41. Duplicate OG titles
const duplicateOgTitlesRule: SiteRule = (ctx) => {
  const pagesWithOg = ctx.pages.filter((p) => p.ogTitle);
  const groups = groupBy(pagesWithOg, (p) =>
    p.ogTitle!.toLowerCase().trim()
  );
  const issues: SeoIssue[] = [];

  for (const [ogTitle, pages] of groups) {
    if (pages.length < 2) continue;
    issues.push({
      type: "duplicate-og-title",
      severity: "low",
      title: "Duplicate Open Graph title",
      description: `${pages.length} pages share the og:title "${ogTitle.slice(0, 60)}${ogTitle.length > 60 ? "…" : ""}". Unique OG titles improve social sharing clarity.`,
      fixType: "quick",
    });
  }
  return issues;
};

// 42. Pages with identical H1 and meta title (site-wide detection across multiple pages)
// (per-page version is in meta.ts rule 10; this site-level rule detects the pattern at scale)
const h1TitleIdenticalSiteRule: SiteRule = (ctx) => {
  const offenders = ctx.pages.filter((p) => {
    if (!p.title || p.h1s.length === 0) return false;
    return p.h1s[0].toLowerCase().trim() === p.title.toLowerCase().trim();
  });
  if (offenders.length < 3) return []; // already caught per-page, only surface if widespread
  return [
    {
      type: "h1-title-identical-sitewide",
      severity: "info",
      title: "H1 matches meta title on most pages",
      description: `${offenders.length} pages have identical H1 and meta titles. Diversifying H1s from titles adds keyword coverage across the site.`,
      fixType: "quick",
    },
  ];
};

export function runDuplicateRules(ctx: SiteContext): SeoIssue[] {
  return [
    duplicateTitlesRule,
    duplicateDescriptionsRule,
    duplicateH1Rule,
    duplicateOgTitlesRule,
    h1TitleIdenticalSiteRule,
  ].flatMap((rule) => rule(ctx));
}
