import type { QueueProvider } from "./types";
import { createAzureQueueProvider } from "./providers/azure-queue";
import { SQSQueueProvider } from "./providers/sqs";
import { MockQueueProvider } from "./providers/mock";

function createProvider(): QueueProvider {
  const name = process.env.QUEUE_PROVIDER ?? "mock";

  switch (name) {
    case "bullmq": {
      // Lazy require: bullmq is Pi-only and not installed in Azure. A top-level import would
      // cause esbuild to hoist require("bullmq") to module init, crashing the worker before
      // GRPC function registration completes. Deferring to here means it only runs on Pi.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { BullMQProvider } = require("./providers/bullmq") as { BullMQProvider: new () => QueueProvider };
      return new BullMQProvider();
    }
    case "azure-queue":
      return createAzureQueueProvider();
    case "sqs":
      return new SQSQueueProvider();
    case "mock":
      return new MockQueueProvider();
    default:
      throw new Error(
        `Unknown QUEUE_PROVIDER: "${name}". Valid: bullmq, azure-queue, sqs, mock`
      );
  }
}

export const queueProvider: QueueProvider = createProvider();
export type { QueueProvider, JobHandler, EnqueueOpts, JobContext } from "./types";
