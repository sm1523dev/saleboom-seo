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

// 38. Duplicate meta titles — one issue per affected page so AI can fix each individually
const duplicateTitlesRule: SiteRule = (ctx) => {
  const pagesWithTitle = ctx.pages.filter((p) => p.title);
  const groups = groupBy(pagesWithTitle, (p) => p.title!.toLowerCase().trim());
  const issues: SeoIssue[] = [];

  for (const [title, pages] of groups) {
    if (pages.length < 2) continue;
    for (const page of pages) {
      issues.push({
        type: "duplicate-meta-title",
        severity: "high",
        title: "Duplicate meta title",
        description: `This page shares the title "${title.slice(0, 60)}${title.length > 60 ? "…" : ""}" with ${pages.length - 1} other page(s). A unique title is needed for proper indexing.`,
        fixType: "quick",
        pageUrl: page.url,
      });
    }
  }
  return issues;
};

// 39. Duplicate meta descriptions — one issue per affected page
const duplicateDescriptionsRule: SiteRule = (ctx) => {
  const pagesWithDesc = ctx.pages.filter((p) => p.description);
  const groups = groupBy(pagesWithDesc, (p) => p.description!.toLowerCase().trim());
  const issues: SeoIssue[] = [];

  for (const [desc, pages] of groups) {
    if (pages.length < 2) continue;
    for (const page of pages) {
      issues.push({
        type: "duplicate-meta-description",
        severity: "high",
        title: "Duplicate meta description",
        description: `This page shares the same description "${desc.slice(0, 80)}${desc.length > 80 ? "…" : ""}" with ${pages.length - 1} other page(s). Unique descriptions improve click-through rate.`,
        fixType: "quick",
        pageUrl: page.url,
      });
    }
  }
  return issues;
};

// 40. Duplicate H1 headings — one issue per affected page
const duplicateH1Rule: SiteRule = (ctx) => {
  const pagesWithH1 = ctx.pages.filter((p) => p.h1s.length > 0);
  const groups = groupBy(pagesWithH1, (p) => p.h1s[0].toLowerCase().trim());
  const issues: SeoIssue[] = [];

  for (const [h1, pages] of groups) {
    if (pages.length < 2) continue;
    for (const page of pages) {
      issues.push({
        type: "duplicate-h1",
        severity: "medium",
        title: "Duplicate H1 heading",
        description: `This page shares the H1 "${h1.slice(0, 60)}${h1.length > 60 ? "…" : ""}" with ${pages.length - 1} other page(s). Unique H1s help search engines understand each page's distinct focus.`,
        fixType: "quick",
        pageUrl: page.url,
      });
    }
  }
  return issues;
};

// 41. Duplicate OG titles — one issue per affected page
const duplicateOgTitlesRule: SiteRule = (ctx) => {
  const pagesWithOg = ctx.pages.filter((p) => p.ogTitle);
  const groups = groupBy(pagesWithOg, (p) => p.ogTitle!.toLowerCase().trim());
  const issues: SeoIssue[] = [];

  for (const [ogTitle, pages] of groups) {
    if (pages.length < 2) continue;
    for (const page of pages) {
      issues.push({
        type: "duplicate-og-title",
        severity: "low",
        title: "Duplicate Open Graph title",
        description: `This page shares the og:title "${ogTitle.slice(0, 60)}${ogTitle.length > 60 ? "…" : ""}" with ${pages.length - 1} other page(s). Unique OG titles improve social sharing clarity.`,
        fixType: "quick",
        pageUrl: page.url,
      });
    }
  }
  return issues;
};

// 42. H1 matches meta title — one issue per affected page (only surfaces if widespread)
const h1TitleIdenticalSiteRule: SiteRule = (ctx) => {
  const offenders = ctx.pages.filter((p) => {
    if (!p.title || p.h1s.length === 0) return false;
    return p.h1s[0].toLowerCase().trim() === p.title.toLowerCase().trim();
  });
  if (offenders.length < 3) return [];
  return offenders.map((page) => ({
    type: "h1-title-identical-sitewide",
    severity: "info" as const,
    title: "H1 matches meta title",
    description: `This page's H1 and meta title are identical. Diversifying them adds keyword coverage.`,
    fixType: "quick" as const,
    pageUrl: page.url,
  }));
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
