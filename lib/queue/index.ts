import type { QueueProvider } from "./types";
import { createAzureQueueProvider } from "./providers/azure-queue";
import { BullMQProvider } from "./providers/bullmq";
import { SQSQueueProvider } from "./providers/sqs";
import { MockQueueProvider } from "./providers/mock";

function createProvider(): QueueProvider {
  const name = process.env.QUEUE_PROVIDER ?? "mock";

  switch (name) {
    case "bullmq":
      return new BullMQProvider();
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
