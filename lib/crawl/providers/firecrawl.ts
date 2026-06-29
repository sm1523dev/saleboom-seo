import { Firecrawl, SdkError, JobTimeoutError } from "firecrawl";
import type { CrawlProvider } from "../types";
import { PageResultSchema, CrawlResultSchema, type PageResult, type CrawlResult } from "../types";

export { SdkError as FirecrawlError, JobTimeoutError as FirecrawlTimeoutError };

export class FirecrawlCrawlProvider implements CrawlProvider {
  private readonly client: Firecrawl;

  constructor() {
    const timeoutMs = process.env.FIRECRAWL_TIMEOUT_MS
      ? Number(process.env.FIRECRAWL_TIMEOUT_MS)
      : 30_000;

    this.client = new Firecrawl({
      apiKey: process.env.FIRECRAWL_API_KEY,
      apiUrl: process.env.FIRECRAWL_API_URL,
      timeoutMs,
      maxRetries: 3,
      backoffFactor: 2,
    });
  }

  async scrapeUrl(url: string): Promise<PageResult> {
    const doc = await this.client.scrape(url, {
      formats: ["markdown", "html", "links"],
      onlyMainContent: true,
    });

    return PageResultSchema.parse({
      url: doc.metadata?.url ?? url,
      markdown: doc.markdown,
      html: doc.html,
      links: doc.links,
      metadata: doc.metadata,
    });
  }

  async crawlSite(url: string, opts?: { limit?: number }): Promise<CrawlResult> {
    const job = await this.client.crawl(url, {
      limit: opts?.limit ?? 100,
      scrapeOptions: {
        formats: ["markdown", "html", "links"],
        onlyMainContent: true,
      },
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
}
