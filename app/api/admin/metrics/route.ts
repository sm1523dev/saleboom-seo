import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { metricsEvents } from "@/lib/db/schema";
import { authProvider } from "@/lib/auth";
import { gte, sql } from "drizzle-orm";
import { checkAndAlert } from "@/lib/metrics/alerts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await authProvider.getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const [daily, hourly, fiveMin] = await Promise.all([
    db
      .select({
        scans_triggered: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.triggered')`,
        scans_completed: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.completed')`,
        scans_failed: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.failed')`,
        avg_duration_ms: sql<number>`avg(${metricsEvents.value}) filter (where ${metricsEvents.event} = 'scan.completed')`,
        avg_issues_critical: sql<number>`avg((${metricsEvents.metadata}->>'critical_count')::numeric) filter (where ${metricsEvents.event} = 'scan.completed')`,
        avg_issues_high: sql<number>`avg((${metricsEvents.metadata}->>'high_count')::numeric) filter (where ${metricsEvents.event} = 'scan.completed')`,
        avg_issues_medium: sql<number>`avg((${metricsEvents.metadata}->>'medium_count')::numeric) filter (where ${metricsEvents.event} = 'scan.completed')`,
        avg_issues_low: sql<number>`avg((${metricsEvents.metadata}->>'low_count')::numeric) filter (where ${metricsEvents.event} = 'scan.completed')`,
      })
      .from(metricsEvents)
      .where(gte(metricsEvents.createdAt, oneDayAgo)),

    db
      .select({
        triggered: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.triggered')`,
        completed: sql<number>`count(*) filter (where ${metricsEvents.event} in ('scan.completed', 'scan.failed'))`,
        failed: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.failed')`,
      })
      .from(metricsEvents)
      .where(gte(metricsEvents.createdAt, oneHourAgo)),

    db
      .select({ count: sql<number>`count(*)` })
      .from(metricsEvents)
      .where(gte(metricsEvents.createdAt, fiveMinAgo)),
  ]);

  const d = daily[0];
  const h = hourly[0];

  const triggered1h = Number(h?.triggered ?? 0);
  const completed1h = Number(h?.completed ?? 0);
  const failed1h = Number(h?.failed ?? 0);
  const queueDepth = Math.max(0, triggered1h - completed1h);
  const total1h = completed1h + failed1h;
  const failureRate1h = total1h > 0 ? failed1h / total1h : 0;

  await checkAndAlert();

  return NextResponse.json({
    window: { day: "24h", hour: "1h", spike: "5min" },
    scans: {
      triggered_today: Number(d?.scans_triggered ?? 0),
      completed_today: Number(d?.scans_completed ?? 0),
      failed_today: Number(d?.scans_failed ?? 0),
      avg_duration_ms: Math.round(Number(d?.avg_duration_ms ?? 0)),
    },
    issues_per_scan: {
      critical: Number((d?.avg_issues_critical ?? 0)).toFixed(1),
      high: Number((d?.avg_issues_high ?? 0)).toFixed(1),
      medium: Number((d?.avg_issues_medium ?? 0)).toFixed(1),
      low: Number((d?.avg_issues_low ?? 0)).toFixed(1),
    },
    queue: {
      depth_1h: queueDepth,
      failure_rate_1h: Number(failureRate1h.toFixed(4)),
    },
    errors_500_5min: Number(fiveMin[0]?.count ?? 0),
  });
}
