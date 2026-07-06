import { initTelemetry } from "@/lib/telemetry/sdk";
initTelemetry("saleboomseo-worker");

import { queueProvider } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { startBullBoard } from "./bull-board";
import { handleScanJob } from "./handlers/scan.handler";
import { handleRescanJob } from "./handlers/rescan.handler";
import { handleAeoJob } from "./handlers/aeo.handler";
import { seedGlobalProviders } from "@/lib/aeo/seed-providers";

const log = logger.child({ component: "worker" });

queueProvider.registerHandler("scan", handleScanJob);
queueProvider.registerHandler("rescan", handleRescanJob);
queueProvider.registerHandler("aeo-scan", handleAeoJob);

async function main() {
  await queueProvider.start();
  await seedGlobalProviders();
  await queueProvider.schedule("rescan", "0 0 * * 0");
  await queueProvider.schedule("aeo-scan", "0 3 * * *");
  startBullBoard();
  log.info("started — listening for jobs");

  const shutdown = async () => {
    log.info("shutting down...");
    await queueProvider.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  log.error("fatal error", { error: String(err) });
  process.exit(1);
});
