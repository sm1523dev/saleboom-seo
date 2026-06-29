import type { CrawlResult, PageResult } from "@/lib/crawl/types";
import type { ParsedPage, SiteContext, SeoIssue, CoreWebVitals } from "./types";
import { parseHtmlForSeo } from "./html-parser";
import { runMetaRules } from "./rules/meta";
import { runContentRules } from "./rules/content";
import { runTechnicalRules } from "./rules/technical";
import { runStructuredDataRules } from "./rules/structured-data";
import { runDuplicateRules } from "./rules/duplicates";
import { runPerformanceRules } from "./rules/performance";

export type { SeoIssue, SiteContext, ParsedPage, CoreWebVitals };

export interface BuildSiteContextOpts {
  baseUrl: string;
  robotsTxtContent?: string;
  sitemapUrls?: string[];
  // Optional per-URL Core Web Vitals from PageSpeed Insights API
  cwvByUrl?: Record<string, CoreWebVitals>;
}

export function buildPageContext(
  page: PageResult,
  opts: Pick<BuildSiteContextOpts, "baseUrl" | "cwvByUrl">
): ParsedPage {
  const url = page.url;
  const meta = page.metadata ?? {};
  const html = page.html;
  const markdown = page.markdown ?? "";

  const parsed = parseHtmlForSeo(html, url);

  const wordCount = markdown
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  let hasHttps = false;
  try {
    hasHttps = new URL(url).protocol === "https:";
  } catch {
    hasHttps = false;
  }

  return {
    url,
    statusCode: meta.statusCode ?? 200,
    title: meta.title,
    description: meta.description,
    ogTitle: meta.ogTitle,
    ogDescription: meta.ogDescription,
    ogImage: meta.ogImage,
    language: meta.language,
    langAttr: parsed.langAttr,
    canonical: parsed.canonical,
    robotsMeta: parsed.robotsMeta,
    viewport: parsed.viewport,
    charset: parsed.charset,
    twitterCard: parsed.twitterCard,
    h1s: parsed.h1s,
    h2s: parsed.h2s,
    h3s: parsed.h3s,
    jsonLd: parsed.jsonLd,
    jsonLdParseErrors: parsed.jsonLdParseErrors,
    images: parsed.images,
    internalLinks: parsed.internalLinks,
    externalLinks: parsed.externalLinks,
    blankTargetLinksNoRel: parsed.blankTargetLinksNoRel,
    mixedContentSrcs: parsed.mixedContentSrcs,
    wordCount,
    hasHttps,
    cwv: opts.cwvByUrl?.[url],
  };
}

export function buildSiteContext(
  crawlResult: CrawlResult,
  opts: BuildSiteContextOpts
): SiteContext {
  const pages = crawlResult.pages.map((page) =>
    buildPageContext(page, opts)
  );

  return {
    baseUrl: opts.baseUrl,
    pages,
    robotsTxt: {
      accessible: opts.robotsTxtContent !== undefined,
      content: opts.robotsTxtContent ?? "",
    },
    sitemap: {
      accessible: (opts.sitemapUrls?.length ?? 0) > 0,
      urls: opts.sitemapUrls ?? [],
    },
  };
}

export function runSeoRules(ctx: SiteContext): SeoIssue[] {
  const { pages } = ctx;

  return [
    ...runMetaRules(pages, ctx),
    ...runContentRules(pages, ctx),
    ...runTechnicalRules(pages, ctx),
    ...runStructuredDataRules(pages, ctx),
    ...runDuplicateRules(ctx),
    ...runPerformanceRules(pages, ctx),
  ];
}
