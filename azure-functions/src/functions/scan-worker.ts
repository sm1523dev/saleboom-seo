import { app, InvocationContext } from "@azure/functions";
import { ScanJobMessageSchema } from "@/lib/queue/types";
import { handleScanJob } from "@/workers/handlers/scan.handler";
import type { JobContext } from "@/lib/queue/types";

function decodeMessage(message: unknown): unknown {
  if (typeof message !== "string") return message;
  // Azure Functions may deliver the raw base64 string (messageEncoding=utf8)
  // or the already-decoded JSON string (messageEncoding=base64).
  try {
    return JSON.parse(message);
  } catch {
    // Fallback: try base64-decode first, then parse
    return JSON.parse(Buffer.from(message, "base64").toString("utf8"));
  }
}

async function scanWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const raw = decodeMessage(message);
  const parsed = ScanJobMessageSchema.safeParse(raw);

  if (!parsed.success) {
    const detail = JSON.stringify(parsed.error.flatten());
    context.error("scan-worker: message schema invalid", { raw, detail });
    // Throw so Azure retries and eventually moves to scan-poison (observable in App Insights)
    throw new Error(`Invalid scan job message: ${detail}`);
  }

  const { scanId, websiteId } = parsed.data;

  const jobContext: JobContext = {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async (_pct: number) => { /* no-op */ },
  };

  await handleScanJob({ scanId, websiteId }, jobContext);
}

app.storageQueue("scan-worker", {
  queueName: "scan",
  connection: "AzureWebJobsStorage",
  handler: scanWorkerHandler,
});
