import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { users, websites, scans, issues, metricsEvents } from "@/lib/db/schema";
import { sql, gte, count, desc } from "drizzle-orm";
import { LocalTime } from "@/components/shared/local-time";

export const metadata: Metadata = { title: "System Stats" };

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

type SeverityCount = { severity: "critical" | "high" | "medium" | "low" | "info"; count: number };

const SEVERITY_STYLES: Record<string, { dot: string; label: string }> = {
  critical: { dot: "bg-red-500", label: "Critical" },
  high: { dot: "bg-orange-500", label: "High" },
  medium: { dot: "bg-yellow-500", label: "Medium" },
  low: { dot: "bg-blue-500", label: "Low" },
  info: { dot: "bg-muted-foreground", label: "Info" },
};

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  failed: "bg-red-500/15 text-red-400 border-red-500/20",
  running: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  pending: "bg-muted text-muted-foreground border-border",
};

export default async function AdminStatsPage() {
  await requireAdmin();

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    userCountResult,
    websiteCountResult,
    scanMetrics,
    issuesBySeverity,
    recentScans,
  ] = await Promise.all([
    db.select({ count: count() }).from(users),
    db.select({ count: count() }).from(websites),
    db
      .select({
        completed_today: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.completed')`,
        failed_today: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.failed')`,
        triggered_today: sql<number>`count(*) filter (where ${metricsEvents.event} = 'scan.triggered')`,
        avg_duration_ms: sql<number>`avg(${metricsEvents.value}) filter (where ${metricsEvents.event} = 'scan.completed')`,
      })
      .from(metricsEvents)
      .where(gte(metricsEvents.createdAt, oneDayAgo)),
    db
      .select({ severity: issues.severity, count: count() })
      .from(issues)
      .where(sql`${issues.resolvedAt} is null`)
      .groupBy(issues.severity),
    db
      .select({
        id: scans.id,
        status: scans.status,
        createdAt: scans.createdAt,
        updatedAt: scans.updatedAt,
        startedAt: scans.startedAt,
        completedAt: scans.completedAt,
      })
      .from(scans)
      .orderBy(desc(scans.createdAt))
      .limit(5),
  ]);

  const totalUsers = userCountResult[0]?.count ?? 0;
  const totalWebsites = websiteCountResult[0]?.count ?? 0;
  const metrics = scanMetrics[0];
  const completedToday = Number(metrics?.completed_today ?? 0);
  const failedToday = Number(metrics?.failed_today ?? 0);
  const triggeredToday = Number(metrics?.triggered_today ?? 0);
  const avgDurationMs = Math.round(Number(metrics?.avg_duration_ms ?? 0));
  const totalFinished = completedToday + failedToday;
  const failureRate = totalFinished > 0 ? failedToday / totalFinished : 0;
  const queueDepth = Math.max(0, triggeredToday - totalFinished);

  const severityOrder = ["critical", "high", "medium", "low", "info"] as const;
  const severityMap = new Map<string, number>(
    (issuesBySeverity as SeverityCount[]).map((r) => [r.severity, Number(r.count)])
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">System Stats</h1>
        <p className="text-sm text-muted-foreground">
          Real-time platform metrics — last updated <LocalTime date={now} timeStyle="short" />.
        </p>
      </div>

      {/* Row 1 — KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Total Users</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{totalUsers.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">registered accounts</p>
        </div>

        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Active Websites</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{totalWebsites.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">tracked domains</p>
        </div>

        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Scans Today</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{completedToday.toLocaleString()}</p>
          <p className="mt-1 text-xs text-muted-foreground">completed in 24 h</p>
        </div>

        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Failed Today</p>
          <p
            className={
              "mt-1 text-3xl font-bold tracking-tight " +
              (failedToday > 0 ? "text-red-400" : "")
            }
          >
            {failedToday.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">scan errors in 24 h</p>
        </div>
      </div>

      {/* Row 2 — Issues + Performance */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Open issues by severity */}
        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold">Open Issues by Severity</p>
          <ul className="space-y-2.5">
            {severityOrder.map((sev) => {
              const cnt = severityMap.get(sev) ?? 0;
              const style = SEVERITY_STYLES[sev];
              const maxCount = Math.max(1, ...Array.from(severityMap.values()));
              const barWidth = `${Math.round((cnt / maxCount) * 100)}%`;
              return (
                <li key={sev} className="flex items-center gap-3">
                  <span
                    className={"h-2 w-2 shrink-0 rounded-full " + style.dot}
                    aria-hidden="true"
                  />
                  <span className="w-16 text-xs text-muted-foreground">{style.label}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={"absolute inset-y-0 left-0 rounded-full " + style.dot}
                      style={{ width: barWidth }}
                      aria-label={`${cnt} ${style.label} issues`}
                    />
                  </div>
                  <span className="w-8 text-right text-xs font-mono text-foreground">{cnt}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Scan performance */}
        <div className="card-glow rounded-xl border border-border bg-card p-5">
          <p className="mb-4 text-sm font-semibold">Scan Performance</p>
          <dl className="space-y-3">
            <div className="flex items-center justify-between">
              <dt className="text-xs text-muted-foreground">Avg duration</dt>
              <dd className="text-sm font-mono font-semibold">
                {avgDurationMs > 0 ? formatDuration(avgDurationMs) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-muted-foreground">Failure rate (24 h)</dt>
              <dd
                className={
                  "text-sm font-mono font-semibold " +
                  (failureRate > 0.05 ? "text-red-400" : "text-emerald-400")
                }
              >
                {totalFinished > 0 ? formatPercent(failureRate) : "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-muted-foreground">Queue depth (est.)</dt>
              <dd
                className={
                  "text-sm font-mono font-semibold " +
                  (queueDepth > 10 ? "text-yellow-400" : "")
                }
              >
                {queueDepth}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-xs text-muted-foreground">Triggered today</dt>
              <dd className="text-sm font-mono font-semibold">{triggeredToday}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Row 3 — Recent scans table */}
      <div className="card-glow rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <p className="text-sm font-semibold">Recent Scans</p>
        </div>
        {recentScans.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No scans yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Scan ID</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Started</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Duration</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan) => {
                  const durationMs =
                    scan.startedAt && scan.completedAt
                      ? scan.completedAt.getTime() - scan.startedAt.getTime()
                      : null;
                  const badgeClass = STATUS_BADGE[scan.status] ?? STATUS_BADGE.pending;
                  return (
                    <tr
                      key={scan.id}
                      className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors duration-100"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {scan.id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium " +
                            badgeClass
                          }
                        >
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        <LocalTime
                          date={scan.startedAt ?? scan.createdAt}
                          dateStyle="short"
                          timeStyle="short"
                        />
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {durationMs !== null ? formatDuration(durationMs) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
