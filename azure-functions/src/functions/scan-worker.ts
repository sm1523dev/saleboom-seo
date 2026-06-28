import { app, InvocationContext } from "@azure/functions";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { scans } from "../../../lib/db/schema";
import { ScanJobMessageSchema } from "../../../lib/queue/types";

async function scanWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const raw = typeof message === "string" ? JSON.parse(message) : message;
  const parsed = ScanJobMessageSchema.safeParse(raw);

  if (!parsed.success) {
    context.error("Invalid scan job message", parsed.error.flatten());
    return;
  }

  const { scanId } = parsed.data;

  await db
    .update(scans)
    .set({ status: "running", startedAt: new Date(), updatedAt: new Date() })
    .where(eq(scans.id, scanId));

  try {
    // TODO #44: replace with actual Firecrawl crawl
    context.log(`Processing scan ${scanId} — Firecrawl not yet available`);

    await db
      .update(scans)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(scans.id, scanId));
  } catch (err) {
    await db
      .update(scans)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(scans.id, scanId));
    throw err;
  }
}

app.storageQueue("scan-worker", {
  queueName: "scan-jobs",
  connection: "AZURE_STORAGE_CONNECTION_STRING",
  handler: scanWorkerHandler,
});
