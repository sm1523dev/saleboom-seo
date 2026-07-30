import { app, InvocationContext } from "@azure/functions";
import { AiSuggestJobMessageSchema } from "@/lib/queue/types";
import { handleAiSuggestJob } from "@/workers/handlers/ai-suggest.handler";
import type { JobContext } from "@/lib/queue/types";

async function aiSuggestWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const raw = typeof message === "string" ? JSON.parse(message) : message;
  const parsed = AiSuggestJobMessageSchema.safeParse(raw);

  if (!parsed.success) {
    context.error("Invalid ai-suggest job message", parsed.error.flatten());
    return;
  }

  const { scanId, websiteId } = parsed.data;

  const jobContext: JobContext = {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async () => { /* no-op: Azure Functions has no progress API */ },
  };

  await handleAiSuggestJob({ scanId, websiteId }, jobContext);
}

app.storageQueue("ai-suggest-worker", {
  queueName: "ai-suggest",
  connection: "AzureWebJobsStorage",
  handler: aiSuggestWorkerHandler,
});
