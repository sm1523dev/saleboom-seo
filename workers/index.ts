import { queueProvider } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { startBullBoard } from "./bull-board";
import { handleScanJob } from "./handlers/scan.handler";
import { handleRescanJob } from "./handlers/rescan.handler";
import { handleAeoJob } from "./handlers/aeo.handler";

const log = logger.child({ component: "worker" });

queueProvider.registerHandler("scan", handleScanJob);
queueProvider.registerHandler("rescan", handleRescanJob);
queueProvider.registerHandler("aeo-scan", handleAeoJob);

async function main() {
  await queueProvider.start();
  await queueProvider.schedule("rescan", "0 0 * * 0");
  await queueProvider.schedule("aeo-scan", "0 3 * * *"); // 03:00 UTC daily
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
