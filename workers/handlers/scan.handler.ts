import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues, aiSuggestions } from "@/lib/db/schema";
import { crawlProvider } from "@/lib/crawl";
import { buildSiteContext, runSeoRules } from "@/lib/seo-rules";
import { generateSeoSuggestion } from "@/lib/ai/suggest-seo";
import { persistDvsScore } from "@/lib/dvs/score";
import { logger } from "@/lib/logger";
import { withSpan } from "@/lib/telemetry";
import { recordEvent } from "@/lib/metrics";
import { checkAndAlert } from "@/lib/metrics/alerts";
import { captureError } from "@/lib/monitoring/capture";
import type { JobContext } from "@/lib/queue";
import type { SeoIssue } from "@/lib/seo-rules";
import type { ParsedPage } from "@/lib/seo-rules/types";

export type ScanJobData = {
  scanId: string;
  websiteId: string;
  url?: string;
};

export async function handleScanJob(
  data: ScanJobData,
  context: JobContext
): Promise<void> {
  return withSpan(
    "worker.scan",
    {
      "job.id": context.jobId,
      "job.attempt": context.attemptNumber,
      "scan.id": data.scanId,
      "website.id": data.websiteId,
    },
    (span) => _runScanJob(data, context, span)
  );
}

async function _runScanJob(
  data: ScanJobData,
  context: JobContext,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  span: any
): Promise<void> {
  const { scanId, websiteId } = data;
  const log = logger.child({ component: "worker", scanId, websiteId });

  log.info("scan started");
  const jobStart = Date.now();

  await withSpan("db.scan.setRunning", { "scan.id": scanId }, () =>
    db
      .update(scans)
      .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(scans.id, scanId))
  );

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

    log.info("fetched site metadata", { url });
    await context.updateProgress(10);

    // Crawl the site — onProgress writes live counts to DB every poll tick
    const crawlResult = await crawlProvider.crawlSite(url, { limit: 100 }, async ({ completed, total }) => {
      await db
        .update(scans)
        .set({ pagesScanned: completed, totalPages: total, updatedAt: new Date() })
        .where(eq(scans.id, scanId));
    });
    log.info("crawl complete", { pages: crawlResult.pages.length });
    await db
      .update(scans)
      .set({ pagesScanned: crawlResult.pages.length, totalPages: crawlResult.total, updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    await context.updateProgress(60);

    // Persist raw crawl data
    await withSpan("db.scan.persistCrawl", { "scan.id": scanId, "crawl.pages": crawlResult.pages.length }, () =>
      db
        .update(scans)
        .set({ rawCrawl: crawlResult as unknown as Record<string, unknown>, updatedAt: new Date() })
        .where(eq(scans.id, scanId))
    );

    await context.updateProgress(70);

    // Run SEO rules engine
    const siteCtx = buildSiteContext(crawlResult, {
      baseUrl,
      robotsTxtContent,
      sitemapUrls,
    });
    const seoIssues = runSeoRules(siteCtx);
    log.info("rules engine complete", { issues: seoIssues.length });

    // Skip issue types previously ignored by the user for this website
    const ignoredRows = await db
      .selectDistinct({ type: issues.type })
      .from(issues)
      .innerJoin(scans, eq(issues.scanId, scans.id))
      .where(and(eq(scans.websiteId, websiteId), sql`${issues.ignoredAt} is not null`));
    const ignoredTypeSet = new Set(ignoredRows.map((r) => r.type));

    const filteredIssues = ignoredTypeSet.size > 0
      ? seoIssues.filter((i) => !ignoredTypeSet.has(i.type))
      : seoIssues;

    if (filteredIssues.length > 0) {
      await persistIssues(scanId, filteredIssues);
    }

    await context.updateProgress(85);

    // Generate AI suggestions for pages with critical/high issues (up to 10 pages)
    // Skip pages the user already dismissed in a previous scan for this website
    const dismissedPages = await db
      .select({ pageUrl: aiSuggestions.pageUrl })
      .from(aiSuggestions)
      .where(and(
        eq(aiSuggestions.websiteId, websiteId),
        eq(aiSuggestions.status, "dismissed"),
      ));
    const dismissedUrls = new Set(dismissedPages.map((d) => d.pageUrl));

    const pagesNeedingSuggestions = siteCtx.pages
      .filter((p) =>
        !dismissedUrls.has(p.url) &&
        seoIssues.some((i) => i.pageUrl === p.url && (i.severity === "critical" || i.severity === "high"))
      )
      .slice(0, 10);

    if (pagesNeedingSuggestions.length > 0) {
      await generateAndPersistSuggestions(scanId, websiteId, pagesNeedingSuggestions, log);
    }

    await context.updateProgress(95);

    await withSpan("db.scan.setCompleted", { "scan.id": scanId, "issues.count": seoIssues.length }, () =>
      db
        .update(scans)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(scans.id, scanId))
    );

    const durationMs = Date.now() - jobStart;
    const bySeverity = seoIssues.reduce<Record<string, number>>((acc, i) => {
      acc[`${i.severity}_count`] = (acc[`${i.severity}_count`] ?? 0) + 1;
      return acc;
    }, {});

    span.setAttribute("scan.issues_found", seoIssues.length);
    await persistDvsScore(websiteId);
    await recordEvent("scan.completed", durationMs, { scanId, websiteId, ...bySeverity });
    await context.updateProgress(100);
    log.info("scan completed", { issues: seoIssues.length, durationMs });
  } catch (err) {
    log.error("scan failed", { error: String(err) });
    captureError(err, { scanId, websiteId });
    await db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    await recordEvent("scan.failed", undefined, { scanId, websiteId, error: String(err) });
    await checkAndAlert();
    throw err;
  }
}

async function persistIssues(scanId: string, seoIssues: SeoIssue[]): Promise<void> {
  const rows = seoIssues.map((issue) => ({
    scanId,
    pageUrl: issue.pageUrl ?? null,
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

async function generateAndPersistSuggestions(
  scanId: string,
  websiteId: string,
  pages: ParsedPage[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  log: any
): Promise<void> {
  const results = await Promise.allSettled(
    pages.map((p) => generateSeoSuggestion(p, scanId))
  );

  // Build page lookup for current values
  const pageMap = new Map(pages.map((p) => [p.url, p]));

  const rows = results
    .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
    .map((r) => {
      const page = pageMap.get(r.pageUrl);
      return {
        scanId,
        websiteId,
        pageUrl: r.pageUrl,
        currentMetaTitle: page?.title ?? null,
        currentMetaDescription: page?.description ?? null,
        currentH1: page?.h1s?.[0] ?? null,
        metaTitle: r.suggestion.metaTitle,
        metaDescription: r.suggestion.metaDescription,
        h1: r.suggestion.h1,
        latencyMs: r.latencyMs,
        status: "pending" as const,
      };
    });

  if (rows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(aiSuggestions).values(rows as any[]);
    log.info("ai suggestions generated", { count: rows.length });
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
