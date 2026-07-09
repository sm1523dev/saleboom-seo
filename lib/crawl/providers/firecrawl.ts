import { Firecrawl, SdkError, JobTimeoutError } from "firecrawl";
import type { CrawlProvider, OnCrawlProgress } from "../types";
import { PageResultSchema, CrawlResultSchema, type PageResult, type CrawlResult } from "../types";
import { withSpan } from "@/lib/telemetry";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const POLL_INTERVAL_MS = 3_000;

export { SdkError as FirecrawlError, JobTimeoutError as FirecrawlTimeoutError };

export class FirecrawlCrawlProvider implements CrawlProvider {
  private readonly client: Firecrawl;

  constructor(apiKey?: string, config?: Record<string, string>) {
    const timeoutMs = config?.timeoutMs
      ? Number(config.timeoutMs)
      : process.env.FIRECRAWL_TIMEOUT_MS
        ? Number(process.env.FIRECRAWL_TIMEOUT_MS)
        : 30_000;

    this.client = new Firecrawl({
      apiKey: apiKey ?? process.env.FIRECRAWL_API_KEY,
      apiUrl: config?.apiUrl ?? process.env.FIRECRAWL_API_URL,
      timeoutMs,
      maxRetries: 3,
      backoffFactor: 2,
    });
  }

  async scrapeUrl(url: string): Promise<PageResult> {
    return withSpan("crawl.scrapeUrl", { "crawl.url": url, "crawl.provider": "firecrawl" }, async () => {
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
    });
  }

  async crawlSite(url: string, opts?: { limit?: number }, onProgress?: OnCrawlProgress): Promise<CrawlResult> {
    return withSpan(
      "crawl.crawlSite",
      { "crawl.url": url, "crawl.provider": "firecrawl", "crawl.limit": opts?.limit ?? 100 },
      async (span) => {
        const started = await this.client.startCrawl(url, {
          limit: opts?.limit ?? 100,
          scrapeOptions: {
            formats: ["markdown", "html", "links"],
            onlyMainContent: true,
          },
        });

        const jobId = started.id;

        // Poll until completion, emitting progress on each tick
        // eslint-disable-next-line no-constant-condition
        while (true) {
          await sleep(POLL_INTERVAL_MS);
          const status = await this.client.getCrawlStatus(jobId);

          if (onProgress) {
            await onProgress({ completed: status.completed, total: status.total }).catch(() => {});
          }

          if (status.status === "completed") {
            span.setAttribute("crawl.pages_found", status.total);

            return CrawlResultSchema.parse({
              jobId,
              total: status.total,
              pages: status.data.map((doc) => ({
                url: doc.metadata?.url ?? url,
                markdown: doc.markdown,
                html: doc.html,
                links: doc.links,
                metadata: doc.metadata,
              })),
            });
          }

          if (status.status === "failed" || status.status === "cancelled") {
            throw new SdkError(`Crawl ${status.status}: job ${jobId}`);
          }
        }
      }
    );
  }
}
