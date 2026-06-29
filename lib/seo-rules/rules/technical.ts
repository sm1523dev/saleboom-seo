import type { ParsedPage, SiteContext, SeoIssue, SiteRule } from "../types";

// Per-page: HTTPS check
function httpsRule(page: ParsedPage): SeoIssue[] {
  if (!page.hasHttps) {
    return [
      {
        type: "page-not-https",
        severity: "critical",
        title: "Page not served over HTTPS",
        description: `${page.url} is served over HTTP. HTTPS is a Google ranking signal and is required to protect user data.`,
        fixType: "major",
        pageUrl: page.url,
      },
    ];
  }
  return [];
}

// Per-page: 4xx errors
function status4xxRule(page: ParsedPage): SeoIssue[] {
  if (page.statusCode >= 400 && page.statusCode < 500) {
    return [
      {
        type: "page-4xx",
        severity: "critical",
        title: `Page returns ${page.statusCode} error`,
        description: `${page.url} returned HTTP ${page.statusCode}. Pages returning client errors waste crawl budget and create a poor user experience.`,
        fixType: "major",
        pageUrl: page.url,
      },
    ];
  }
  return [];
}

// Per-page: 5xx errors
function status5xxRule(page: ParsedPage): SeoIssue[] {
  if (page.statusCode >= 500) {
    return [
      {
        type: "page-5xx",
        severity: "critical",
        title: `Page returns ${page.statusCode} server error`,
        description: `${page.url} returned HTTP ${page.statusCode}. Server errors prevent indexing and signal instability to search engines.`,
        fixType: "major",
        pageUrl: page.url,
      },
    ];
  }
  return [];
}

// Site-level: robots.txt missing
const robotsTxtMissingRule: SiteRule = (ctx) => {
  if (!ctx.robotsTxt.accessible) {
    return [
      {
        type: "robots-txt-missing",
        severity: "high",
        title: "robots.txt not accessible",
        description: `${ctx.baseUrl}/robots.txt returned an error or is missing. Search engines crawl without directives, which may lead to crawling unwanted pages.`,
        fixType: "major",
      },
    ];
  }
  return [];
};

// Site-level: robots.txt blocks all crawlers
const robotsTxtBlocksAllRule: SiteRule = (ctx) => {
  if (!ctx.robotsTxt.accessible || !ctx.robotsTxt.content) return [];
  const content = ctx.robotsTxt.content.toLowerCase();
  // Look for User-agent: * followed by Disallow: / without a subsequent Allow: /
  if (
    content.includes("user-agent: *") &&
    content.includes("disallow: /") &&
    !content.includes("allow: /")
  ) {
    return [
      {
        type: "robots-txt-blocks-all",
        severity: "critical",
        title: "robots.txt blocks all crawlers",
        description: `${ctx.baseUrl}/robots.txt contains Disallow: / for all user agents with no Allow override. This prevents the entire site from being indexed.`,
        fixType: "major",
      },
    ];
  }
  return [];
};

// Site-level: robots.txt blocks CSS/JS assets
const robotsTxtBlocksAssetsRule: SiteRule = (ctx) => {
  if (!ctx.robotsTxt.accessible || !ctx.robotsTxt.content) return [];
  const content = ctx.robotsTxt.content.toLowerCase();
  const blocksStyling =
    content.includes("disallow: /*.css") ||
    content.includes("disallow: /*.js") ||
    content.includes("disallow: /assets") ||
    content.includes("disallow: /static");
  if (blocksStyling) {
    return [
      {
        type: "robots-txt-blocks-assets",
        severity: "high",
        title: "robots.txt blocks CSS or JS resources",
        description: `${ctx.baseUrl}/robots.txt may block crawling of CSS or JS files. Googlebot needs these to render and evaluate pages correctly.`,
        fixType: "major",
      },
    ];
  }
  return [];
};

// Site-level: sitemap missing
const sitemapMissingRule: SiteRule = (ctx) => {
  if (!ctx.sitemap.accessible) {
    return [
      {
        type: "sitemap-missing",
        severity: "high",
        title: "sitemap.xml not accessible",
        description: `${ctx.baseUrl}/sitemap.xml returned an error or is missing. Submitting a sitemap helps search engines discover all pages faster.`,
        fixType: "major",
      },
    ];
  }
  return [];
};

// Site-level: sitemap not referenced in robots.txt
const sitemapNotInRobotsRule: SiteRule = (ctx) => {
  if (!ctx.robotsTxt.accessible || !ctx.sitemap.accessible) return [];
  const content = ctx.robotsTxt.content.toLowerCase();
  if (!content.includes("sitemap:")) {
    return [
      {
        type: "sitemap-not-in-robots",
        severity: "low",
        title: "Sitemap not referenced in robots.txt",
        description: `${ctx.baseUrl}/robots.txt does not reference the sitemap via a Sitemap: directive. Adding it helps all crawlers discover the sitemap automatically.`,
        fixType: "quick",
      },
    ];
  }
  return [];
};

// Site-level: crawled pages not listed in sitemap
const pagesNotInSitemapRule: SiteRule = (ctx) => {
  if (!ctx.sitemap.accessible || ctx.sitemap.urls.length === 0) return [];

  const sitemapSet = new Set(
    ctx.sitemap.urls.map((u) => {
      try {
        const parsed = new URL(u);
        parsed.hash = "";
        return parsed.href;
      } catch {
        return u;
      }
    })
  );

  const missing = ctx.pages
    .filter((p) => {
      if (p.statusCode < 200 || p.statusCode >= 400) return false;
      return !sitemapSet.has(p.url);
    })
    .map((p) => p.url);

  if (missing.length === 0) return [];

  return [
    {
      type: "pages-not-in-sitemap",
      severity: "medium",
      title: "Crawled pages missing from sitemap",
      description: `${missing.length} live page${missing.length > 1 ? "s are" : " is"} not in sitemap.xml: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}. Missing pages may be slow to be indexed.`,
      fixType: "major",
    },
  ];
};

export function runTechnicalRules(
  pages: ParsedPage[],
  ctx: SiteContext
): SeoIssue[] {
  const perPage = pages.flatMap((p) => [
    ...httpsRule(p),
    ...status4xxRule(p),
    ...status5xxRule(p),
  ]);

  const siteLevel = [
    robotsTxtMissingRule,
    robotsTxtBlocksAllRule,
    robotsTxtBlocksAssetsRule,
    sitemapMissingRule,
    sitemapNotInRobotsRule,
    pagesNotInSitemapRule,
  ].flatMap((rule) => rule(ctx));

  return [...perPage, ...siteLevel];
}
