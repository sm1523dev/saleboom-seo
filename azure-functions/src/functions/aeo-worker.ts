import { app, InvocationContext } from "@azure/functions";
import { AeoJobMessageSchema } from "@/lib/queue/types";
import { handleAeoJob } from "@/workers/handlers/aeo.handler";
import type { JobContext } from "@/lib/queue/types";

async function aeoWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const raw = typeof message === "string" ? JSON.parse(message) : message;
  const parsed = AeoJobMessageSchema.safeParse(raw);

  if (!parsed.success) {
    context.error("Invalid aeo job message", parsed.error.flatten());
    return;
  }

  const { websiteId, scanId } = parsed.data;

  const jobContext: JobContext = {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async () => { /* no-op: Azure Functions has no progress API */ },
  };

  await handleAeoJob({ websiteId, ...(scanId ? { scanId } : {}) }, jobContext);
}

app.storageQueue("aeo-worker", {
  queueName: "aeo-scan",
  connection: "AzureWebJobsStorage",
  handler: aeoWorkerHandler,
});
