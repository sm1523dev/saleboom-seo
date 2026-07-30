import { eq, and, sql, or, isNull, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, issues, cmsConnections } from "@/lib/db/schema";
import { getQueueProvider } from "@/lib/queue";
import { getCrawlProvider } from "@/lib/crawl";
import { buildSiteContext, runSeoRules } from "@/lib/seo-rules";
import { isArchiveUrl, ISSUE_TYPE_TO_FIELD } from "@/lib/fix-classifier";
import type { CmsCapabilities } from "@/lib/cms/probe";
import { persistDvsScore } from "@/lib/dvs/score";
import { logger } from "@/lib/logger";
import { withSpan } from "@/lib/telemetry";
import { recordEvent } from "@/lib/metrics";
import { checkAndAlert } from "@/lib/metrics/alerts";
import { captureError } from "@/lib/monitoring/capture";
import type { JobContext } from "@/lib/queue";
import { detectPlatformFromCrawl } from "@/lib/platform-detect";
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

  // Reset scans that are stuck in "running" from a prior Function timeout where the
  // catch block never fired (Azure killed the process before it could write "failed").
  await db
    .update(scans)
    .set({ status: "failed", updatedAt: new Date() })
    .where(
      and(
        eq(scans.status, "running"),
        sql`${scans.id} != ${scanId}`,
        sql`${scans.updatedAt} < now() - interval '10 minutes'`
      )
    );

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

    // Crawl the site — onProgress writes live counts to DB every poll tick.
    // Hard 7-minute wall-clock limit so the catch block fires before Azure kills the process.
    let crawlTimeoutId: ReturnType<typeof setTimeout> | undefined;
    const crawlResult = await Promise.race([
      (await getCrawlProvider()).crawlSite(url, { limit: 100 }, async ({ completed, total }) => {
        await db
          .update(scans)
          .set({ pagesScanned: completed, totalPages: total, updatedAt: new Date() })
          .where(eq(scans.id, scanId));
      }),
      new Promise<never>((_, reject) => {
        crawlTimeoutId = setTimeout(
          () => reject(new Error("Crawl exceeded 7-minute limit — site too slow or too large")),
          7 * 60_000
        );
      }),
    ]).finally(() => clearTimeout(crawlTimeoutId));
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

    // Auto-detect platform from crawl HTML — only store if user hasn't confirmed one yet
    const [site] = await db.select({ platformHintStatus: websites.platformHintStatus }).from(websites).where(eq(websites.id, websiteId)).limit(1);
    if (site?.platformHintStatus !== "confirmed") {
      const detected = detectPlatformFromCrawl(crawlResult.pages);
      if (detected) {
        await db.update(websites).set({ platformHint: detected, platformHintStatus: "unconfirmed", updatedAt: new Date() }).where(eq(websites.id, websiteId));
      }
    }

    await context.updateProgress(70);

    // Filter out system/non-content URLs before SEO analysis so they don't
    // inflate issue counts or lower scores — these pages are never indexed by
    // Google and never cited by AI models.
    const SYSTEM_PATH_PATTERNS = [
      /^\/wp-login\.php/,
      /^\/wp-admin/,
      /^\/wp-cron\.php/,
      /^\/xmlrpc\.php/,
      /^\/wp-includes\//,
      /^\/feed\//,
      /[?&]feed=/,
      /^\/wp-sitemap/,
      /\/wp-sitemap.*\.xml/,
      /\/sitemap.*\.xml/,
      /^\/author\//,
      /^\/tag\//,
      /^\/wp-json\//,
    ];

    const contentPages = crawlResult.pages.filter((p) => {
      try {
        const path = new URL(p.url).pathname + new URL(p.url).search;
        return !SYSTEM_PATH_PATTERNS.some((re) => re.test(path));
      } catch {
        return true;
      }
    });

    log.info("system pages filtered", {
      before: crawlResult.pages.length,
      after: contentPages.length,
      filtered: crawlResult.pages.length - contentPages.length,
    });

    const filteredCrawlResult = { ...crawlResult, pages: contentPages };

    // Run SEO rules engine
    const siteCtx = buildSiteContext(filteredCrawlResult, {
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

    // Load CMS capabilities for this website so quick-fix classification
    // reflects what can actually be pushed, not just what the issue type allows.
    const [cmsConn] = await db
      .select({ capabilities: cmsConnections.capabilities })
      .from(cmsConnections)
      .where(eq(cmsConnections.websiteId, websiteId))
      .limit(1);
    const capabilities = (cmsConn?.capabilities ?? null) as CmsCapabilities | null;

    if (filteredIssues.length > 0) {
      await persistIssues(scanId, filteredIssues, capabilities);
    }

    await context.updateProgress(85);

    await withSpan("db.scan.setCompleted", { "scan.id": scanId, "issues.count": seoIssues.length }, () =>
      db
        .update(scans)
        .set({ status: "completed", completedAt: new Date(), seoCompletedAt: new Date(), updatedAt: new Date() })
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

    // DB join lock: enqueue ai-suggest once both phases are done.
    // SEO fires immediately if aeoExpected=false; waits for AEO otherwise.
    const [acquired] = await db
      .update(scans)
      .set({ aiTriggeredAt: new Date() })
      .where(
        and(
          eq(scans.id, scanId),
          isNull(scans.aiTriggeredAt),
          or(eq(scans.aeoExpected, false), isNotNull(scans.aeoCompletedAt))
        )
      )
      .returning({ id: scans.id });

    if (acquired) {
      await (await getQueueProvider()).enqueue("ai-suggest", { scanId, websiteId });
      log.info("ai-suggest enqueued by seo completion");
    }

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

function resolveFixType(issue: SeoIssue, capabilities: CmsCapabilities | null): "quick" | "major" {
  if (issue.fixType !== "quick") return (issue.fixType as "major") ?? "major";
  // Archive pages (category/tag/author/date) are never patchable via REST
  if (issue.pageUrl && isArchiveUrl(issue.pageUrl)) return "major";
  // No CMS connected — nothing can be pushed automatically
  if (!capabilities) return "major";
  // Downgrade if the specific field this issue maps to isn't writable
  const field = ISSUE_TYPE_TO_FIELD[issue.type];
  if (!field) return "major";
  if (field === "meta_title" && !capabilities.meta_title) return "major";
  if (field === "meta_description" && !capabilities.meta_description) return "major";
  if (field === "h1" && !capabilities.h1) return "major";
  return "quick";
}

async function persistIssues(scanId: string, seoIssues: SeoIssue[], capabilities: CmsCapabilities | null): Promise<void> {
  const rows = seoIssues.map((issue) => ({
    scanId,
    pageUrl: issue.pageUrl ?? null,
    type: issue.type,
    severity: issue.severity,
    title: issue.title,
    description: issue.description,
    fixType: resolveFixType(issue, capabilities),
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
