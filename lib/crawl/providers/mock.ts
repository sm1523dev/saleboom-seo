import type { CrawlProvider, OnCrawlProgress } from "../types";
import type { PageResult, CrawlResult } from "../types";

const MOCK_MARKDOWN = `
# Example Page

This is a mock page for local development.

## About Us

We help businesses grow through SEO optimisation.

## Contact

Email: hello@example.com
`.trim();

export class MockCrawlProvider implements CrawlProvider {
  async scrapeUrl(url: string): Promise<PageResult> {
    console.log("[crawl:mock] scrapeUrl →", url);
    return {
      url,
      markdown: MOCK_MARKDOWN,
      html: `<html><body><h1>Example Page</h1><p>${MOCK_MARKDOWN}</p></body></html>`,
      links: [`${url}/about`, `${url}/contact`],
      metadata: {
        title: "Example Page — Mock",
        description: "Mock page for local development.",
        statusCode: 200,
        url,
      },
    };
  }

  async crawlSite(url: string, opts?: { limit?: number }, onProgress?: OnCrawlProgress): Promise<CrawlResult> {
    console.log("[crawl:mock] crawlSite →", url, { limit: opts?.limit ?? 100 });
    const page = await this.scrapeUrl(url);
    if (onProgress) await onProgress({ completed: 1, total: 1 }).catch(() => {});
    return {
      jobId: "mock-job-id",
      total: 1,
      pages: [page],
    };
  }
}
