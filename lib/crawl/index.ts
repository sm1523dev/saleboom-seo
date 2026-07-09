import type { CrawlProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";

function createByName(name: string, apiKey: string | undefined, config: Record<string, string>): CrawlProvider {
  switch (name) {
    case "firecrawl":
      return new (require("./providers/firecrawl").FirecrawlCrawlProvider)(apiKey, config);
    case "mock":
      return new (require("./providers/mock").MockCrawlProvider)();
    default:
      throw new Error(`Unknown crawl provider: "${name}". Valid: firecrawl, mock`);
  }
}

function createFromEnv(): CrawlProvider {
  return createByName(process.env.CRAWL_PROVIDER ?? "mock", undefined, {});
}

export async function getCrawlProvider(): Promise<CrawlProvider> {
  const resolved = await resolveInfraProvider("crawl");
  if (resolved) return createByName(resolved.name, resolved.key, resolved.config);
  return createFromEnv();
}

export type { CrawlProvider, PageResult, CrawlResult, PageMetadata } from "./types";
