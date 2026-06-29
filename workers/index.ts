import { queueProvider } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { handleScanJob } from "./handlers/scan.handler";
import { handleRescanJob } from "./handlers/rescan.handler";

const log = logger.child({ component: "worker" });

queueProvider.registerHandler("scan", handleScanJob);
queueProvider.registerHandler("rescan", handleRescanJob);

async function main() {
  await queueProvider.start();
  await queueProvider.schedule("rescan", "0 0 * * 0");
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
