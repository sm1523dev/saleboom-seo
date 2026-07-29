import { initTelemetry } from "@/lib/telemetry/sdk";
initTelemetry("saleboomseo-worker");

import { getQueueProvider } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { startBullBoard } from "./bull-board";
import { handleScanJob } from "./handlers/scan.handler";
import { handleRescanJob } from "./handlers/rescan.handler";
import { handleAeoJob } from "./handlers/aeo.handler";
import { handleDigestJob } from "./handlers/digest.handler";
import { seedGlobalProviders } from "@/lib/aeo/seed-providers";

const log = logger.child({ component: "worker" });

async function main() {
  const queue = await getQueueProvider();

  queue.registerHandler("scan", handleScanJob);
  queue.registerHandler("rescan", handleRescanJob);
  queue.registerHandler("aeo-scan", handleAeoJob);
  queue.registerHandler("digest", handleDigestJob);

  await queue.start();
  await seedGlobalProviders();
  await queue.schedule("rescan", "0 0 * * 0");
  await queue.schedule("aeo-scan", "0 3 * * *");
  await queue.schedule("digest", "0 8 * * 1");
  startBullBoard();
  log.info("started — listening for jobs");

  const shutdown = async () => {
    log.info("shutting down...");
    await queue.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.error("fatal error", { error: String(err) });
  process.exit(1);
});
