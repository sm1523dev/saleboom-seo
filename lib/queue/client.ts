import { QueueClient, QueueServiceClient } from "@azure/storage-queue";

let _client: QueueServiceClient | null = null;

export function getQueueServiceClient(): QueueServiceClient {
  if (_client) return _client;

  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING environment variable is not set");
  }

  _client = QueueServiceClient.fromConnectionString(connectionString);
  return _client;
}

export function getQueueClient(name: string): QueueClient {
  return getQueueServiceClient().getQueueClient(name);
}
