export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FixType = "quick" | "major";

export interface SeoIssue {
  type: string;
  severity: Severity;
  title: string;
  description: string;
  fixType: FixType;
  pageUrl?: string;
}

export interface ParsedImage {
  src: string;
  alt: string | null;
  hasWidthHeight: boolean;
}

export interface CoreWebVitals {
  lcp?: number;  // Largest Contentful Paint in seconds
  cls?: number;  // Cumulative Layout Shift score
  fcp?: number;  // First Contentful Paint in seconds
}

export interface ParsedPage {
  url: string;
  statusCode: number;
  // From Firecrawl metadata
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  language?: string;
  // Parsed from HTML
  langAttr?: string;
  canonical?: string;
  robotsMeta?: string;
  viewport?: string;
  charset?: string;
  twitterCard?: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  jsonLd: unknown[];
  jsonLdParseErrors: number;
  images: ParsedImage[];
  internalLinks: string[];
  externalLinks: string[];
  blankTargetLinksNoRel: string[];
  mixedContentSrcs: string[];
  wordCount: number;
  hasHttps: boolean;
  cwv?: CoreWebVitals;
}

export interface RobotsTxt {
  accessible: boolean;
  content: string;
}

export interface Sitemap {
  accessible: boolean;
  urls: string[];
}

export interface SiteContext {
  baseUrl: string;
  pages: ParsedPage[];
  robotsTxt: RobotsTxt;
  sitemap: Sitemap;
}

export type PageRule = (page: ParsedPage, ctx: SiteContext) => SeoIssue[];
export type SiteRule = (ctx: SiteContext) => SeoIssue[];
