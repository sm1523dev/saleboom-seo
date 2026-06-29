import { Queue, Worker, type Job } from "bullmq";
import type { QueueProvider, JobHandler, EnqueueOpts, JobContext } from "../types";

export class BullMQProvider implements QueueProvider {
  private readonly connection: { host: string; port: number } | { url: string };
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];
  private readonly handlers = new Map<string, JobHandler>();

  constructor() {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is required for QUEUE_PROVIDER=bullmq");

    // Upstash Redis and other TLS Redis use rediss:// scheme
    if (url.startsWith("rediss://") || url.startsWith("redis://")) {
      this.connection = { url };
    } else {
      const parsed = new URL(`redis://${url}`);
      this.connection = {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
      };
    }
  }

  private getQueue(jobType: string): Queue {
    if (!this.queues.has(jobType)) {
      this.queues.set(
        jobType,
        new Queue(jobType, { connection: this.connection as never })
      );
    }
    return this.queues.get(jobType)!;
  }

  async enqueue<T extends Record<string, unknown>>(
    jobType: string,
    data: T,
    opts?: EnqueueOpts
  ): Promise<string> {
    const queue = this.getQueue(jobType);
    const job = await queue.add(jobType, data, {
      delay: opts?.delayMs,
      priority: opts?.priority,
      jobId: opts?.jobId,
    });
    return job.id ?? "";
  }

  async schedule(
    jobType: string,
    cron: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const queue = this.getQueue(jobType);
    await queue.upsertJobScheduler(
      `scheduler:${jobType}`,
      { pattern: cron },
      { name: jobType, data: data ?? {} }
    );
  }

  registerHandler<T extends Record<string, unknown>>(
    jobType: string,
    handler: JobHandler<T>
  ): void {
    this.handlers.set(jobType, handler as JobHandler);
  }

  async start(): Promise<void> {
    for (const [jobType, handler] of this.handlers) {
      const worker = new Worker(
        jobType,
        async (job: Job) => {
          const context: JobContext = {
            jobId: job.id ?? "",
            attemptNumber: job.attemptsMade,
            updateProgress: (percent) => job.updateProgress(percent),
            log: (msg) => console.log(`[worker:${jobType}:${job.id}]`, msg),
          };
          await handler(job.data, context);
        },
        { connection: this.connection as never, concurrency: 5 }
      );
      this.workers.push(worker);
    }
  }

  async stop(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }
}
