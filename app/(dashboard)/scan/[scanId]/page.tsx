import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { scans, websites } from "@/lib/db/schema";
import { getServerSession } from "@/lib/auth-utils";

export const metadata: Metadata = {
  title: "Scan Status",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ scanId: string }>;
};

export default async function ScanStatusPage({ params }: Props) {
  const { scanId } = await params;
  await getServerSession();

  // Fetch scan + website in two queries (no relations defined yet)
  const [scan] = await db
    .select({
      id: scans.id,
      status: scans.status,
      websiteId: scans.websiteId,
      startedAt: scans.startedAt,
      completedAt: scans.completedAt,
    })
    .from(scans)
    .where(eq(scans.id, scanId))
    .limit(1);

  if (!scan) notFound();

  const [website] = await db
    .select({ url: websites.url, name: websites.name })
    .from(websites)
    .where(eq(websites.id, scan.websiteId))
    .limit(1);

  const statusConfig = STATUS_CONFIG[scan.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Scan Status</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {website?.url ?? scan.id}
        </p>
      </header>

      <section
        aria-label="Scan progress"
        className="card-glow rounded-xl border border-border bg-card p-8 text-center"
      >
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <span className="font-mono text-2xl text-primary">
            {statusConfig.icon}
          </span>
        </div>

        <h2 className="text-lg font-semibold">{statusConfig.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {statusConfig.description}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-left sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd className="mt-0.5 text-sm font-medium capitalize">
              {scan.status}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Website</dt>
            <dd className="mt-0.5 truncate text-sm font-medium">
              {website?.name ?? "—"}
            </dd>
          </div>
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <dt className="text-xs text-muted-foreground">Started</dt>
            <dd className="mt-0.5 text-sm font-medium">
              {scan.startedAt
                ? new Intl.DateTimeFormat("en", { timeStyle: "short", dateStyle: "short" }).format(scan.startedAt)
                : "—"}
            </dd>
          </div>
        </dl>

        {scan.status === "completed" && (
          <Link
            href={`/scan/${scan.id}/results`}
            className="btn-press mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            View Audit Results →
          </Link>
        )}

        {(scan.status === "pending" || scan.status === "running") && (
          <p className="mt-6 text-xs text-muted-foreground">
            This page will update in a future release. For now, check back in a
            few minutes and refresh.
          </p>
        )}
      </section>

      <div className="flex gap-3 text-sm">
        <Link
          href="/scan"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Scan another URL
        </Link>
        <span className="text-border">·</span>
        <Link
          href="/dashboard"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

const STATUS_CONFIG = {
  pending: {
    icon: "○",
    heading: "Scan queued",
    description: "Your scan has been added to the queue and will start shortly.",
  },
  running: {
    icon: "◎",
    heading: "Scan in progress",
    description:
      "We're crawling your website and running SEO checks. This typically takes 1–3 minutes.",
  },
  completed: {
    icon: "◈",
    heading: "Scan complete",
    description: "Your SEO audit is ready. Click below to view the results.",
  },
  failed: {
    icon: "⊘",
    heading: "Scan failed",
    description:
      "Something went wrong during the scan. Try starting a new scan, or contact support if the issue persists.",
  },
} as const;
