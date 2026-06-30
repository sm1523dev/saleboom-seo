import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import { logger } from "@/lib/logger";

const QUEUE_NAMES = ["scan", "rescan", "aeo-scan"];
const PORT = Number(process.env.BULL_BOARD_PORT ?? 4000);

export function startBullBoard(): void {
  if (process.env.QUEUE_PROVIDER !== "bullmq") return;

  const url = process.env.REDIS_URL;
  if (!url) return;

  const connection = { url };
  const queues = QUEUE_NAMES.map((name) => new BullMQAdapter(new Queue(name, { connection: connection as never })));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  createBullBoard({ queues, serverAdapter });

  const app = express();
  app.use("/admin/queues", serverAdapter.getRouter());

  app.listen(PORT, () => {
    logger.child({ component: "bull-board" }).info(`queue UI running`, { url: `http://localhost:${PORT}/admin/queues` });
  });
}
