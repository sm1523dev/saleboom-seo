import { db } from "@/lib/db";
import { metricsEvents } from "@/lib/db/schema";

export type MetricEvent =
  | "scan.triggered"
  | "scan.completed"
  | "scan.failed"
  | "http.500";

export async function recordEvent(
  event: MetricEvent,
  value?: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(metricsEvents).values({ event, value, metadata });
  } catch {
    // Never throw from metrics — observability must not break the happy path
  }
}
