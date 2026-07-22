import { app, InvocationContext } from "@azure/functions";
import { handleDigestJob } from "@/workers/handlers/digest.handler";
import type { JobContext } from "@/lib/queue/types";

async function digestWorkerHandler(message: unknown, context: InvocationContext): Promise<void> {
  const jobContext: JobContext = {
    jobId: context.invocationId,
    attemptNumber: 1,
    log: (msg: string) => context.log(msg),
    updateProgress: async (_pct: number) => {},
  };

  await handleDigestJob({}, jobContext);
}

app.storageQueue("digest-worker", {
  queueName: "digest",
  connection: "AZURE_STORAGE_CONNECTION_STRING",
  handler: digestWorkerHandler,
});
