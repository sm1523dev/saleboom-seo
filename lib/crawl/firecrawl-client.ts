import { Firecrawl, SdkError, JobTimeoutError, type ScrapeOptions, type CrawlOptions } from "firecrawl";
import { PageResultSchema, CrawlResultSchema, type PageResult, type CrawlResult } from "./types";

export { SdkError as FirecrawlError, JobTimeoutError as FirecrawlTimeoutError };

function createClient(): Firecrawl {
  const timeoutMs = process.env.FIRECRAWL_TIMEOUT_MS
    ? Number(process.env.FIRECRAWL_TIMEOUT_MS)
    : 30_000;

  return new Firecrawl({
    apiKey: process.env.FIRECRAWL_API_KEY,
    apiUrl: process.env.FIRECRAWL_API_URL ?? "http://localhost:3002",
    timeoutMs,
    maxRetries: 3,
    backoffFactor: 2,
  });
}

const client = createClient();

export async function scrapeUrl(url: string, opts?: ScrapeOptions): Promise<PageResult> {
  const doc = await client.scrape(url, {
    formats: ["markdown", "html", "links"],
    onlyMainContent: true,
    ...opts,
  });

  return PageResultSchema.parse({
    url: doc.metadata?.url ?? url,
    markdown: doc.markdown,
    html: doc.html,
    links: doc.links,
    metadata: doc.metadata,
  });
}

export async function crawlSite(url: string, opts?: CrawlOptions): Promise<CrawlResult> {
  const job = await client.crawl(url, {
    limit: 100,
    scrapeOptions: { formats: ["markdown", "html", "links"], onlyMainContent: true },
    ...opts,
  });

  return CrawlResultSchema.parse({
    jobId: job.id,
    total: job.total,
    pages: job.data.map((doc) => ({
      url: doc.metadata?.url ?? url,
      markdown: doc.markdown,
      html: doc.html,
      links: doc.links,
      metadata: doc.metadata,
    })),
  });
}
