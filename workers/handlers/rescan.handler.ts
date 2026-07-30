import { and, isNull, lt, sql, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites, aeoQueries } from "@/lib/db/schema";
import { getQueueProvider } from "@/lib/queue";
import type { JobContext } from "@/lib/queue";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function handleRescanJob(
  _data: Record<string, unknown>,
  context: JobContext
): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);

  const staleWebsites = await db
    .selectDistinctOn([scans.websiteId], {
      websiteId: scans.websiteId,
      lastCompletedAt: sql<Date>`max(${scans.completedAt})`,
    })
    .from(scans)
    .innerJoin(websites, eq(scans.websiteId, websites.id))
    .where(and(isNull(websites.deletedAt), isNull(scans.deletedAt)))
    .groupBy(scans.websiteId)
    .having(lt(sql<Date>`max(${scans.completedAt})`, sevenDaysAgo));

  context.log(`enqueueing rescans for ${staleWebsites.length} website(s)`);

  const queue = await getQueueProvider();
  for (const { websiteId } of staleWebsites) {
    const [hasAeoQ] = await db
      .select({ id: aeoQueries.id })
      .from(aeoQueries)
      .where(and(eq(aeoQueries.websiteId, websiteId), eq(aeoQueries.active, true)))
      .limit(1);
    const aeoExpected = !!hasAeoQ;

    const [newScan] = await db
      .insert(scans)
      .values({ websiteId, status: "pending", aeoExpected })
      .returning({ id: scans.id });

    await Promise.all([
      queue.enqueue("scan", { scanId: newScan.id, websiteId }),
      ...(aeoExpected ? [queue.enqueue("aeo-scan", { websiteId, scanId: newScan.id })] : []),
    ]);
  }
}
