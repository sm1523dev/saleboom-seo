import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans } from "@/lib/db/schema";
import type { JobContext } from "@/lib/queue";

export type ScanJobData = {
  scanId: string;
  websiteId: string;
};

export async function handleScanJob(
  data: ScanJobData,
  context: JobContext
): Promise<void> {
  const { scanId } = data;

  context.log(`starting scan ${scanId}`);

  await db
    .update(scans)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(scans.id, scanId));

  try {
    await context.updateProgress(10);
    // TODO #59: replace stub with crawlProvider.crawlSite(website.url)
    context.log(`crawl stub for scan ${scanId}`);
    await context.updateProgress(50);

    // TODO #58: replace stub with aiProvider.generateStructured(...)
    context.log(`ai stub for scan ${scanId}`);
    await context.updateProgress(90);

    await db
      .update(scans)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(scans.id, scanId));

    await context.updateProgress(100);
    context.log(`scan ${scanId} completed`);
  } catch (err) {
    await db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    throw err;
  }
}
