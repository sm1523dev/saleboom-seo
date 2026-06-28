import { app, InvocationContext, Timer } from "@azure/functions";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { db } from "../lib/db";
import { scans, websites } from "../../../lib/db/schema";
import { enqueueScan } from "../../../lib/queue/enqueue-scan";

async function rescanTimerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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

  context.log(`Enqueueing rescans for ${staleWebsites.length} website(s)`);

  for (const { websiteId } of staleWebsites) {
    const [newScan] = await db
      .insert(scans)
      .values({ websiteId, status: "pending" })
      .returning({ id: scans.id });

    await enqueueScan(websiteId, newScan.id);
  }
}

app.timer("rescan-timer", {
  schedule: "0 0 * * 0",
  handler: rescanTimerHandler,
});
