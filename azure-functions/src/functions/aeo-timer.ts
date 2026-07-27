import { app, InvocationContext, Timer } from "@azure/functions";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { aeoQueries } from "../../../lib/db/schema";
import { queueProvider } from "../../../lib/queue";

async function aeoTimerHandler(_timer: Timer, context: InvocationContext): Promise<void> {
  // Find all distinct websites that have at least one active AEO query.
  // The aeo-worker skips websites with no queries, so only enqueue where work exists.
  const rows = await db
    .selectDistinct({ websiteId: aeoQueries.websiteId })
    .from(aeoQueries)
    .where(eq(aeoQueries.active, true));

  context.log(`Enqueueing AEO scans for ${rows.length} website(s)`);

  for (const { websiteId } of rows) {
    await queueProvider.enqueue("aeo-scan", { websiteId });
  }
}

app.timer("aeo-timer", {
  schedule: "0 0 3 * * *",  // 3am UTC daily
  handler: aeoTimerHandler,
});
