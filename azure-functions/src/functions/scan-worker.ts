import { app, InvocationContext } from "@azure/functions";
import { ScanJobMessageSchema } from "@/lib/queue/types";
import { handleScanJob } from "@/workers/handlers/scan.handler";
import type { JobContext } from "@/lib/queue/types";

async function scanWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const raw = typeof message === "string" ? JSON.parse(message) : message;
  const parsed = ScanJobMessageSchema.safeParse(raw);

  if (!parsed.success) {
    context.error("Invalid scan job message", parsed.error.flatten());
    return;
  }

  const { scanId, websiteId } = parsed.data;

  const jobContext: JobContext = {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async (_pct: number) => { /* no-op: Azure Functions has no progress API */ },
  };

  await handleScanJob({ scanId, websiteId }, jobContext);
}

app.storageQueue("scan-worker", {
  queueName: "scan",
  connection: "AZURE_STORAGE_CONNECTION_STRING",
  handler: scanWorkerHandler,
});
