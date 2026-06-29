import { queueProvider } from "@/lib/queue";
import { handleScanJob } from "./handlers/scan.handler";
import { handleRescanJob } from "./handlers/rescan.handler";

queueProvider.registerHandler("scan", handleScanJob);
queueProvider.registerHandler("rescan", handleRescanJob);

async function main() {
  await queueProvider.start();

  // Register weekly rescan schedule (every Sunday midnight UTC)
  await queueProvider.schedule("rescan", "0 0 * * 0");

  console.log("[workers] started — listening for jobs");

  const shutdown = async () => {
    console.log("[workers] shutting down...");
    await queueProvider.stop();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("[workers] fatal error:", err);
  process.exit(1);
});
