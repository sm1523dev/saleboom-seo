import type { QueueProvider, JobHandler, EnqueueOpts } from "../types";

export class SQSQueueProvider implements QueueProvider {
  constructor() {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for QUEUE_PROVIDER=sqs"
      );
    }
    if (!process.env.SQS_QUEUE_URL_PREFIX) {
      throw new Error("SQS_QUEUE_URL_PREFIX is required for QUEUE_PROVIDER=sqs");
    }
  }

  async enqueue<T extends Record<string, unknown>>(
    jobType: string,
    data: T,
    opts?: EnqueueOpts
  ): Promise<string> {
    const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
    const client = new SQSClient({ region: process.env.AWS_REGION ?? "us-east-1" });
    const queueUrl = `${process.env.SQS_QUEUE_URL_PREFIX}/${jobType}`;

    const result = await client.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ ...data, enqueuedAt: new Date().toISOString() }),
        ...(opts?.delayMs ? { DelaySeconds: Math.floor(opts.delayMs / 1000) } : {}),
        ...(opts?.jobId ? { MessageDeduplicationId: opts.jobId } : {}),
      })
    );

    return result.MessageId ?? "";
  }

  async schedule(): Promise<void> {
    throw new Error("SQS does not support cron scheduling natively. Use Amazon EventBridge.");
  }

  registerHandler<T extends Record<string, unknown>>(
    _jobType: string,
    _handler: JobHandler<T>
  ): void {
    // No-op: SQS workers are Lambda functions triggered by SQS events.
  }

  async start(): Promise<void> {
    // No-op: workers run as Lambda functions.
  }

  async stop(): Promise<void> {
    // No-op.
  }
}
