import type { QueueProvider } from "./types";

function createProvider(): QueueProvider {
  const name = process.env.QUEUE_PROVIDER ?? "mock";

  switch (name) {
    case "bullmq":
      return new (require("./providers/bullmq").BullMQProvider)();
    case "azure-queue":
      return new (require("./providers/azure-queue").AzureQueueProvider)();
    case "sqs":
      return new (require("./providers/sqs").SQSQueueProvider)();
    case "mock":
      return new (require("./providers/mock").MockQueueProvider)();
    default:
      throw new Error(
        `Unknown QUEUE_PROVIDER: "${name}". Valid: bullmq, azure-queue, sqs, mock`
      );
  }
}

export const queueProvider: QueueProvider = createProvider();
export type { QueueProvider, JobHandler, EnqueueOpts, JobContext } from "./types";
