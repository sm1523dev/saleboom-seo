import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues } from "@/lib/db/schema";
import { crawlProvider } from "@/lib/crawl";
import { buildSiteContext, runSeoRules } from "@/lib/seo-rules";
import type { JobContext } from "@/lib/queue";
import type { SeoIssue } from "@/lib/seo-rules";

export type ScanJobData = {
  scanId: string;
  websiteId: string;
  url?: string;
};

export async function handleScanJob(
  data: ScanJobData,
  context: JobContext
): Promise<void> {
  const { scanId, websiteId } = data;

  context.log(`starting scan ${scanId}`);

  await db
    .update(scans)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(scans.id, scanId));

  try {
    // Resolve URL — prefer from job data, fall back to DB
    let url = data.url;
    if (!url) {
      const [website] = await db
        .select({ url: websites.url })
        .from(websites)
        .where(eq(websites.id, websiteId))
        .limit(1);
      if (!website) throw new Error(`Website ${websiteId} not found`);
      url = website.url;
    }

    const baseUrl = (() => {
      const u = new URL(url);
      return `${u.protocol}//${u.host}`;
    })();

    await context.updateProgress(5);

    // Fetch robots.txt and sitemap in parallel (best-effort, 5s timeout each)
    const [robotsTxtContent, sitemapUrls] = await Promise.all([
      fetchTextWithTimeout(`${baseUrl}/robots.txt`, 5_000).catch(() => undefined),
      fetchSitemapUrls(`${baseUrl}/sitemap.xml`).catch(() => []),
    ]);

    context.log(`fetched site metadata for ${url}`);
    await context.updateProgress(10);

    // Crawl the site
    const crawlResult = await crawlProvider.crawlSite(url, { limit: 100 });
    context.log(`crawl complete — ${crawlResult.pages.length} page(s)`);
    await context.updateProgress(60);

    // Persist raw crawl data
    await db
      .update(scans)
      .set({ rawCrawl: crawlResult as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(scans.id, scanId));

    await context.updateProgress(70);

    // Run SEO rules engine
    const siteCtx = buildSiteContext(crawlResult, {
      baseUrl,
      robotsTxtContent,
      sitemapUrls,
    });
    const seoIssues = runSeoRules(siteCtx);
    context.log(`rules engine found ${seoIssues.length} issue(s)`);

    // Persist issues
    if (seoIssues.length > 0) {
      await persistIssues(scanId, seoIssues);
    }

    await context.updateProgress(95);

    await db
      .update(scans)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(scans.id, scanId));

    await context.updateProgress(100);
    context.log(`scan ${scanId} completed — ${seoIssues.length} issue(s) persisted`);
  } catch (err) {
    context.log(`scan ${scanId} failed: ${String(err)}`);
    await db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    throw err;
  }
}

async function persistIssues(scanId: string, seoIssues: SeoIssue[]): Promise<void> {
  const rows = seoIssues.map((issue) => ({
    scanId,
    type: issue.type,
    severity: issue.severity,
    title: issue.title,
    description: issue.description,
    fixType: issue.fixType,
  }));

  // Drizzle insert accepts multiple rows; split into batches to avoid
  // exceeding Postgres parameter limits (~65k params / 6 cols = ~10k rows)
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(issues).values(rows.slice(i, i + BATCH));
  }
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs: number
): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return undefined;
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const content = await fetchTextWithTimeout(sitemapUrl, 5_000);
  if (!content) return [];
  const matches = content.match(/<loc>([\s\S]*?)<\/loc>/gi);
  if (!matches) return [];
  return matches
    .map((m) => m.replace(/<\/?loc>/gi, "").trim())
    .filter((u) => u.startsWith("http"));
}
