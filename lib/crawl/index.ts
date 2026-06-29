import type { CrawlProvider } from "./types";

function createProvider(): CrawlProvider {
  const name = process.env.CRAWL_PROVIDER ?? "mock";

  switch (name) {
    case "firecrawl":
      return new (require("./providers/firecrawl").FirecrawlCrawlProvider)();
    case "mock":
      return new (require("./providers/mock").MockCrawlProvider)();
    default:
      throw new Error(
        `Unknown CRAWL_PROVIDER: "${name}". Valid: firecrawl, mock`
      );
  }
}

export const crawlProvider: CrawlProvider = createProvider();
export type { CrawlProvider, PageResult, CrawlResult, PageMetadata } from "./types";
