import { db } from "@/lib/db";
import { metricsEvents } from "@/lib/db/schema";
import { gte, and, eq, sql } from "drizzle-orm";
import { notifyAlert } from "./notify";

const FAILURE_RATE_THRESHOLD = 0.05;
const QUEUE_DEPTH_THRESHOLD = 50;
const ERROR_500_THRESHOLD = 5;

export async function checkAndAlert(): Promise<void> {
  if (!process.env.SLACK_ALERT_WEBHOOK && !process.env.ALERT_EMAIL_TO) return;

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [failureRateAlert, queueDepthAlert, errorSpikeAlert] = await Promise.all([
    checkFailureRate(oneHourAgo),
    checkQueueDepth(oneHourAgo),
    checkErrorSpike(fiveMinAgo),
  ]);

  if (failureRateAlert) await notifyAlert(failureRateAlert);
  if (queueDepthAlert) await notifyAlert(queueDepthAlert);
  if (errorSpikeAlert) await notifyAlert(errorSpikeAlert);
}

async function checkFailureRate(since: Date): Promise<string | null> {
  const [row] = await db
    .select({
      total: sql<number>`count(*) filter (where ${metricsEvents.event} in ('scan.completed', 'scan.failed'))`,
      failed: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.failed')`,
    })
    .from(metricsEvents)
    .where(gte(metricsEvents.createdAt, since));

  const total = Number(row?.total ?? 0);
  const failed = Number(row?.failed ?? 0);
  if (total < 5) return null; // not enough data

  const rate = failed / total;
  if (rate > FAILURE_RATE_THRESHOLD) {
    return `Scan failure rate ${(rate * 100).toFixed(1)}% in last hour (${failed}/${total} scans failed). Threshold: ${FAILURE_RATE_THRESHOLD * 100}%`;
  }
  return null;
}

async function checkQueueDepth(since: Date): Promise<string | null> {
  const [row] = await db
    .select({
      triggered: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.triggered')`,
      completed: sql<number>`count(*) filter (where ${metricsEvents.event} in ('scan.completed', 'scan.failed'))`,
    })
    .from(metricsEvents)
    .where(gte(metricsEvents.createdAt, since));

  const depth = Math.max(0, Number(row?.triggered ?? 0) - Number(row?.completed ?? 0));
  if (depth > QUEUE_DEPTH_THRESHOLD) {
    return `Queue depth is ${depth} (threshold: ${QUEUE_DEPTH_THRESHOLD}). Jobs may be backing up.`;
  }
  return null;
}

async function checkErrorSpike(since: Date): Promise<string | null> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(metricsEvents)
    .where(and(eq(metricsEvents.event, "http.500"), gte(metricsEvents.createdAt, since)));

  const count = Number(row?.count ?? 0);
  if (count >= ERROR_500_THRESHOLD) {
    return `${count} HTTP 500 errors in the last 5 minutes. Threshold: ${ERROR_500_THRESHOLD}`;
  }
  return null;
}
