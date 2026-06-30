import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { websites, aeoProviders, aeoQueries, aeoMentions, aeoCitations, aeoScores } from "@/lib/db/schema";
import { queryAeoProvider } from "@/lib/aeo/query-engine";
import { parseMention, extractCitations } from "@/lib/aeo/mention-parser";
import { computeAeoScore } from "@/lib/aeo/score";
import { persistDvsScore } from "@/lib/dvs/score";
import { logger } from "@/lib/logger";
import { captureError } from "@/lib/monitoring/capture";
import type { JobContext } from "@/lib/queue";

export type AeoJobData = { websiteId: string };

export async function handleAeoJob(
  data: AeoJobData,
  context: JobContext
): Promise<void> {
  const { websiteId } = data;
  const log = logger.child({ component: "aeo-worker", websiteId });
  log.info("aeo scan started");

  try {
    const [website] = await db
      .select({ url: websites.url, name: websites.name })
      .from(websites)
      .where(eq(websites.id, websiteId))
      .limit(1);

    if (!website) throw new Error(`Website ${websiteId} not found`);

    const domain = (() => {
      try { return new URL(website.url).hostname.replace(/^www\./, ""); }
      catch { return website.name; }
    })();

    // Strip www. and TLD for broader matching ("semrush" matches "SEMrush", "Semrush.com", etc.)
    const brandName = website.name
      .replace(/^www\./, "")
      .replace(/\.[a-z]{2,}$/, "");

    const [providers, queries] = await Promise.all([
      db.select().from(aeoProviders).where(eq(aeoProviders.enabled, true)),
      db.select().from(aeoQueries).where(
        and(eq(aeoQueries.websiteId, websiteId), eq(aeoQueries.active, true))
      ),
    ]);

    if (providers.length === 0 || queries.length === 0) {
      log.info("aeo scan skipped — no providers or queries configured");
      return;
    }

    await context.updateProgress(10);

    const today = new Date().toISOString().slice(0, 10);
    const pairs = providers.flatMap((p) => queries.map((q) => ({ p, q }))).slice(0, 50);
    log.info("running aeo queries", { providers: providers.length, queries: queries.length, pairs: pairs.length });

    const results = await Promise.allSettled(
      // DB providerType is string; cast to the union type used by the query engine
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      pairs.map(({ p, q }) => queryAeoProvider(p as any, q.promptText))
    );

    type MentionRow = {
      websiteId: string;
      providerId: string;
      queryId: string;
      scanDate: string;
      brandMentioned: boolean;
      positionBucket: string | null;
      sentiment: "positive" | "neutral" | "negative" | null;
      surroundingText: string | null;
    };
    const mentionRows: MentionRow[] = [];

    const citationRows: {
      websiteId: string;
      providerId: string;
      queryId: string;
      scanDate: string;
      citedUrl: string;
      isOwnDomain: boolean;
    }[] = [];

    let mentionsFound = 0;
    let successfulQueries = 0;
    let citationsFound = 0;
    let ragQueriesRun = 0;

    for (let i = 0; i < pairs.length; i++) {
      const result = results[i];
      const { p, q } = pairs[i];

      if (result.status === "rejected") {
        log.warn("aeo query failed", { provider: p.displayName, error: String(result.reason) });
        continue;
      }

      const { text, citations: rawCitations } = result.value;
      const mention = parseMention(text, brandName);
      const extracted = extractCitations(text, domain);

      // Merge API-provided citations (Perplexity) with text-extracted ones
      const allCitationUrls = new Set([
        ...rawCitations.map((u) => ({ citedUrl: u, isOwnDomain: isOwnDomainUrl(u, domain) })),
        ...extracted,
      ].map((c) => JSON.stringify(c)));
      const dedupedCitations = Array.from(allCitationUrls).map((s) =>
        JSON.parse(s) as { citedUrl: string; isOwnDomain: boolean }
      );

      mentionRows.push({
        websiteId,
        providerId: p.id,
        queryId: q.id,
        scanDate: today,
        brandMentioned: mention.brandMentioned,
        positionBucket: mention.positionBucket === "absent" ? null : mention.positionBucket,
        sentiment: mention.sentiment,
        surroundingText: mention.surroundingText,
      });

      for (const c of dedupedCitations) {
        citationRows.push({ websiteId, providerId: p.id, queryId: q.id, scanDate: today, ...c });
      }

      if (mention.brandMentioned) mentionsFound++;
      successfulQueries++;
      if (p.providerType === "perplexity") {
        ragQueriesRun++;
        if (dedupedCitations.some((c) => c.isOwnDomain)) citationsFound++;
      }
    }

    await context.updateProgress(70);

    if (mentionRows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.insert(aeoMentions).values(mentionRows as any[]).onConflictDoNothing();
    }
    if (citationRows.length > 0) {
      await db.insert(aeoCitations).values(citationRows);
    }

    await context.updateProgress(80);

    // Compute and persist composite score
    const score = computeAeoScore({
      mentionsFound,
      queriesRun: successfulQueries,
      aiReferrals: 0, // Signal 2 comes from live JS snippet, not from this job
      totalReferrals: 1,
      citationsFound,
      ragQueriesRun,
    });

    await db.insert(aeoScores).values({
      websiteId,
      scoredAt: new Date(),
      signal1Rate: successfulQueries > 0 ? mentionsFound / successfulQueries : 0,
      signal2Index: 0,
      signal3Rate: ragQueriesRun > 0 ? citationsFound / ragQueriesRun : 0,
      compositeScore: score,
    });

    await persistDvsScore(websiteId);
    await context.updateProgress(100);
    log.info("aeo scan completed", { mentionsFound, citationsFound, score });
  } catch (err) {
    log.error("aeo scan failed", { error: String(err) });
    captureError(err, { websiteId });
    throw err;
  }
}

function isOwnDomainUrl(url: string, ownDomain: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === ownDomain || host.endsWith(`.${ownDomain}`);
  } catch {
    return false;
  }
}
