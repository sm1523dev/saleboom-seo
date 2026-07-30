import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, issues, aiSuggestions, websites } from "@/lib/db/schema";
import { buildPageContext } from "@/lib/seo-rules";
import { generateSeoSuggestion } from "@/lib/ai/suggest-seo";
import type { CrawlResult, PageResult } from "@/lib/crawl/types";
import type { ParsedPage } from "@/lib/seo-rules/types";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/monitoring/capture";
import type { JobContext } from "@/lib/queue";

export type AiSuggestJobData = { scanId: string; websiteId: string };

export async function handleAiSuggestJob(
  data: AiSuggestJobData,
  context: JobContext
): Promise<void> {
  const { scanId, websiteId } = data;
  const log = logger.child({ component: "ai-suggest-worker", scanId, websiteId });
  log.info("ai suggest started");

  try {
    const [[scan], [site]] = await Promise.all([
      db.select({ rawCrawl: scans.rawCrawl }).from(scans).where(eq(scans.id, scanId)).limit(1),
      db.select({ url: websites.url }).from(websites).where(eq(websites.id, websiteId)).limit(1),
    ]);

    if (!scan?.rawCrawl) {
      log.warn("no raw crawl data — skipping ai suggest");
      return;
    }

    const crawlResult = scan.rawCrawl as unknown as CrawlResult;
    const baseUrl = (() => {
      try { return site?.url ? new URL(site.url).origin : new URL(crawlResult.pages[0]?.url ?? "").origin; }
      catch { return ""; }
    })();

    // Pages that have critical/high issues in this scan
    const scanIssues = await db
      .select({ pageUrl: issues.pageUrl, severity: issues.severity })
      .from(issues)
      .where(eq(issues.scanId, scanId));

    const highPriorityUrls = new Set(
      scanIssues
        .filter((i) => i.severity === "critical" || i.severity === "high")
        .map((i) => i.pageUrl)
        .filter((u): u is string => !!u)
    );

    if (highPriorityUrls.size === 0) {
      log.info("no high-priority issues — skipping ai suggest");
      return;
    }

    // Skip pages the user has already dismissed for this website
    const dismissed = await db
      .select({ pageUrl: aiSuggestions.pageUrl })
      .from(aiSuggestions)
      .where(and(eq(aiSuggestions.websiteId, websiteId), eq(aiSuggestions.status, "dismissed")));
    const dismissedUrls = new Set(dismissed.map((d) => d.pageUrl));

    // Build ParsedPage objects only for the pages that need suggestions
    const pageMap = new Map<string, PageResult>(crawlResult.pages.map((p) => [p.url, p]));
    const pages: ParsedPage[] = Array.from(highPriorityUrls)
      .filter((url) => !dismissedUrls.has(url) && pageMap.has(url))
      .slice(0, 10)
      .map((url) => buildPageContext(pageMap.get(url)!, { baseUrl }));

    if (pages.length === 0) {
      log.info("all high-priority pages are dismissed — skipping");
      return;
    }

    await context.updateProgress(10);

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      generateAndPersistSuggestions(scanId, websiteId, pages, log),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("ai_timeout")), 2 * 60_000);
      }),
    ])
      .catch((err: unknown) => {
        if (err instanceof Error && err.message === "ai_timeout") {
          log.warn("AI suggestions timed out after 2 minutes");
        } else {
          log.error("AI suggestions failed", { error: String(err) });
        }
      })
      .finally(() => clearTimeout(timeoutId));

    await context.updateProgress(100);
    log.info("ai suggest completed", { pages: pages.length });
  } catch (err) {
    log.error("ai suggest job failed", { error: String(err) });
    captureError(err, { scanId, websiteId });
    // Non-fatal — do not re-throw
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
