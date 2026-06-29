export type JobContext = {
  jobId: string;
  attemptNumber: number;
  updateProgress(percent: number): Promise<void>;
  log(message: string): void;
};

export type JobHandler<T = Record<string, unknown>> = (
  data: T,
  context: JobContext
) => Promise<void>;

export type EnqueueOpts = {
  delayMs?: number;
  priority?: number;
  jobId?: string;
};

export interface QueueProvider {
  enqueue<T extends Record<string, unknown>>(
    jobType: string,
    data: T,
    opts?: EnqueueOpts
  ): Promise<string>;

  schedule(
    jobType: string,
    cron: string,
    data?: Record<string, unknown>
  ): Promise<void>;

  registerHandler<T extends Record<string, unknown>>(
    jobType: string,
    handler: JobHandler<T>
  ): void;

  start(): Promise<void>;
  stop(): Promise<void>;
}

// Legacy scan job message schema — kept for azure-queue provider compatibility
import { z } from "zod";
export const ScanJobMessageSchema = z.object({
  scanId: z.string().uuid(),
  websiteId: z.string().uuid(),
  enqueuedAt: z.string().datetime(),
});
export type ScanJobMessage = z.infer<typeof ScanJobMessageSchema>;
