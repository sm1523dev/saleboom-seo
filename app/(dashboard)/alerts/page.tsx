import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userAlerts, websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";
import { markAllAlertsRead, markAlertRead } from "@/app/actions/alerts.actions";

export const metadata: Metadata = {
  title: "Alerts",
  description: "In-app alerts for AEO brand mention drops and sentiment spikes.",
};

const TYPE_CONFIG: Record<
  string,
  { label: string; colorClass: string }
> = {
  aeo_mention_drop: { label: "Mention Drop", colorClass: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  aeo_sentiment_spike: { label: "Sentiment Spike", colorClass: "bg-red-500/15 text-red-400 border-red-500/30" },
  scan_failed: { label: "Scan Failed", colorClass: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function AlertsPage() {
  const session = await getServerSession();

  const alerts = await db
    .select({
      id: userAlerts.id,
      type: userAlerts.type,
      message: userAlerts.message,
      metadata: userAlerts.metadata,
      readAt: userAlerts.readAt,
      createdAt: userAlerts.createdAt,
      websiteName: websites.name,
    })
    .from(userAlerts)
    .innerJoin(websites, eq(userAlerts.websiteId, websites.id))
    .where(eq(userAlerts.userId, session.user.id))
    .orderBy(desc(userAlerts.createdAt));

  const hasUnread = alerts.some((a) => a.readAt === null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Alerts</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            AEO brand mention drops and sentiment spikes
          </p>
        </div>
        {hasUnread && (
          <form action={markAllAlertsRead}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
            >
              Mark all read
            </button>
          </form>
        )}
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="card-glow flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-16 text-center">
          <span aria-hidden="true" className="font-mono text-3xl text-muted-foreground/40">⊘</span>
          <p className="mt-3 text-sm font-medium text-foreground">No alerts yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Alerts appear here when brand mention rates drop or negative sentiment spikes.
          </p>
        </div>
      ) : (
        <ul className="space-y-2" role="list">
          {alerts.map((alert) => {
            const config = TYPE_CONFIG[alert.type] ?? {
              label: alert.type,
              colorClass: "bg-muted text-muted-foreground border-border",
            };
            const isUnread = alert.readAt === null;

            return (
              <li
                key={alert.id}
                className={`card-glow rounded-lg border bg-card p-4 transition-opacity duration-150 ${
                  isUnread ? "border-border" : "border-border opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Unread indicator */}
                  <div className="mt-1.5 flex-shrink-0">
                    {isUnread ? (
                      <span className="block h-2 w-2 rounded-full bg-primary" aria-label="Unread" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-transparent" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.colorClass}`}
                      >
                        {config.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{alert.websiteName}</span>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        {timeAgo(new Date(alert.createdAt))}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{alert.message}</p>
                  </div>

                  {isUnread && (
                    <form action={markAlertRead.bind(null, alert.id)} className="flex-shrink-0">
                      <button
                        type="submit"
                        aria-label="Mark alert as read"
                        className="rounded border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                      >
                        Mark read
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
