import { getQueueClient } from "./client";
import { QUEUE_NAMES, ScanJobMessage } from "./types";

export async function enqueueScan(websiteId: string, scanId: string): Promise<void> {
  const queueClient = getQueueClient(QUEUE_NAMES.SCAN_JOBS);

  await queueClient.createIfNotExists();

  const message: ScanJobMessage = {
    scanId,
    websiteId,
    enqueuedAt: new Date().toISOString(),
  };

  await queueClient.sendMessage(JSON.stringify(message));
}
