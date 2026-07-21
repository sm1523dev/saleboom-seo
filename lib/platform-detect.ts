import type { PageResult } from "@/lib/crawl/types";

export type Platform = "wordpress" | "shopify" | "webflow" | "github" | "unknown";

export const PLATFORM_LABELS: Record<Platform | "unknown", string> = {
  wordpress: "WordPress",
  shopify: "Shopify",
  webflow: "Webflow",
  github: "Custom / Developer-managed",
  unknown: "I don't know",
};

export const PLATFORM_ICONS: Record<Platform | "unknown", string> = {
  wordpress: "W",
  shopify: "S",
  webflow: "WF",
  github: "</>",
  unknown: "?",
};

export function detectPlatformFromCrawl(pages: PageResult[]): Platform | null {
  const corpus = pages
    .map((p) => [p.url ?? "", p.html ?? "", p.markdown ?? ""].join(" "))
    .join("\n")
    .toLowerCase();

  if (/wp-content\/|wp-json\/|wordpress|xmlrpc\.php/.test(corpus)) return "wordpress";
  if (/cdn\.shopify\.com|shopify\.com\/s\/files|myshopify\.com/.test(corpus)) return "shopify";
  if (/webflow\.com|\.webflow\.|data-wf-page|wf-form/.test(corpus)) return "webflow";
  if (/_next\/static|__next_data__|next\.js|gatsby|hugo|jekyll/.test(corpus)) return "github";

  return null;
}
