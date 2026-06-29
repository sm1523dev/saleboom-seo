import type { Metadata } from "next";
import Link from "next/link";
import { CountUp } from "@/components/animations/count-up";
import { StaggerChildren } from "@/components/animations/stagger-children";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your Digital Visibility Score and key SEO & AEO metrics.",
  robots: { index: false, follow: false },
};

const KPI_CARDS = [
  {
    label: "SEO Score",
    value: 0,
    suffix: "/100",
    description: "Overall health",
  },
  {
    label: "AEO Mentions",
    value: 0,
    suffix: "",
    description: "AI engine citations",
  },
  {
    label: "Open Issues",
    value: 0,
    suffix: "",
    description: "Pending fixes",
  },
  {
    label: "Sites",
    value: 0,
    suffix: "",
    description: "Connected properties",
  },
] as const;

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Heading */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Digital Visibility Score and key metrics
        </p>
      </header>

      {/* KPI Grid */}
      <section aria-label="Key performance indicators">
        <StaggerChildren className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {KPI_CARDS.map((card) => (
            <div
              key={card.label}
              className="card-glow rounded-xl border border-border bg-card p-5"
            >
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="mt-1 font-mono text-3xl font-bold">
                <CountUp to={card.value} suffix={card.suffix} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
            </div>
          ))}
        </StaggerChildren>
      </section>

      {/* Empty State */}
      <section
        aria-label="Get started"
        className="rounded-xl border border-border bg-card p-12 text-center"
      >
        <div
          className="animate-breathe mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"
          aria-hidden="true"
        >
          <span className="text-xl text-primary">⊙</span>
        </div>
        <h2 className="font-semibold">No scan data yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run your first scan to see your Digital Visibility Score
        </p>
        <Link
          href="/scan"
          className="btn-press mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Start a scan →
        </Link>
      </section>
    </div>
  );
}
