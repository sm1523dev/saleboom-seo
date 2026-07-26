import type { QueueServiceClient } from "@azure/storage-queue";
import type { QueueProvider, JobHandler, EnqueueOpts } from "../types";

// Azure Queue Storage provider — enqueue side only.
// Workers are deployed separately as Azure Functions using azure-functions/ directory.
// For full cloud-agnostic workers, use QUEUE_PROVIDER=bullmq instead.
export function createAzureQueueProvider(): QueueProvider {
  return new AzureQueueProvider();
}

class AzureQueueProvider implements QueueProvider {
  // Connection string stored at construction time but client created lazily.
  // Lazy init: @azure/storage-queue has ~30 transitive deps loaded from Azure Files, causing
  // synchronous require() to take >30s during cold start and exceed the GRPC worker timeout.
  // Deferring to the first queue operation allows GRPC registration to complete first.
  private readonly connectionString: string;
  private _client: QueueServiceClient | null = null;

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error(
        "AZURE_STORAGE_CONNECTION_STRING is required for QUEUE_PROVIDER=azure-queue"
      );
    }
    this.connectionString = connectionString;
  }

  private get client(): QueueServiceClient {
    if (!this._client) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { QueueServiceClient: QSC } = require("@azure/storage-queue") as typeof import("@azure/storage-queue");
      this._client = QSC.fromConnectionString(this.connectionString);
    }
    return this._client;
  }

  async enqueue<T extends Record<string, unknown>>(
    jobType: string,
    data: T,
    _opts?: EnqueueOpts
  ): Promise<string> {
    const queueClient = this.client.getQueueClient(jobType);
    await queueClient.createIfNotExists();

    const message = JSON.stringify({ ...data, enqueuedAt: new Date().toISOString() });
    const encoded = Buffer.from(message).toString("base64");
    const result = await queueClient.sendMessage(encoded);
    return result.messageId;
  }

  async schedule(_jobType: string, _cron: string): Promise<void> {
    throw new Error(
      "Azure Queue does not support scheduled/recurring jobs natively. Use QUEUE_PROVIDER=bullmq for scheduling."
    );
  }

  registerHandler<T extends Record<string, unknown>>(
    _jobType: string,
    _handler: JobHandler<T>
  ): void {
    // No-op: Azure Queue workers are deployed as separate Azure Functions.
    // See azure-functions/ directory.
  }

  async start(): Promise<void> {
    // No-op: workers run as Azure Functions, not in-process.
  }

  async stop(): Promise<void> {
    // No-op.
  }
}
