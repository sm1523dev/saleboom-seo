import type { QueueProvider, JobHandler, EnqueueOpts, JobContext } from "../types";
import { randomUUID } from "crypto";

export class MockQueueProvider implements QueueProvider {
  private readonly handlers = new Map<string, JobHandler>();
  private jobCounter = 0;

  async enqueue<T extends Record<string, unknown>>(
    jobType: string,
    data: T,
    _opts?: EnqueueOpts
  ): Promise<string> {
    const jobId = randomUUID();
    this.jobCounter++;
    console.log(`[queue:mock] enqueue ${jobType} #${this.jobCounter} id=${jobId}`, data);

    const handler = this.handlers.get(jobType);
    if (handler) {
      const context: JobContext = {
        jobId,
        attemptNumber: 1,
        updateProgress: async (p) => console.log(`[queue:mock] progress ${p}%`),
        log: (msg) => console.log(`[queue:mock:${jobType}]`, msg),
      };
      // Execute synchronously in-process — ideal for local dev and tests
      setImmediate(() => handler(data, context).catch(console.error));
    }

    return jobId;
  }

  async schedule(jobType: string, cron: string): Promise<void> {
    console.log(`[queue:mock] schedule ${jobType} cron="${cron}" (no-op in mock)`);
  }

  registerHandler<T extends Record<string, unknown>>(
    jobType: string,
    handler: JobHandler<T>
  ): void {
    this.handlers.set(jobType, handler as JobHandler);
  }

  async start(): Promise<void> {
    console.log("[queue:mock] started (in-process mock)");
  }

  async stop(): Promise<void> {
    console.log("[queue:mock] stopped");
  }
}
