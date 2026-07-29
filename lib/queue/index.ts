import type { QueueProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";
import { createAzureQueueProvider } from "./providers/azure-queue";
import { SQSQueueProvider } from "./providers/sqs";
import { MockQueueProvider } from "./providers/mock";

function createByName(name: string): QueueProvider {
  switch (name) {
    case "bullmq": {
      // Lazy require: bullmq is Pi-only and not installed in Azure. A top-level import would
      // cause esbuild to hoist require("bullmq") to module init, crashing the worker before
      // handler registration completes.
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
      throw new Error(`Unknown queue provider: "${name}". Valid: bullmq, azure-queue, sqs, mock`);
  }
}

let _instance: QueueProvider | null = null;

export async function getQueueProvider(): Promise<QueueProvider> {
  if (_instance) return _instance;
  const resolved = await resolveInfraProvider("queue");
  const name = resolved?.name ?? process.env.QUEUE_PROVIDER ?? "mock";
  _instance = createByName(name);
  return _instance;
}

export type { QueueProvider, JobHandler, EnqueueOpts, JobContext } from "./types";
