import type { Metadata } from "next";
import { ScanForm } from "./_components/scan-form";

export const metadata: Metadata = {
  title: "New Scan",
  description: "Enter your website URL to start an SEO and AEO audit.",
  robots: { index: false, follow: false },
};

export default function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">New Scan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter a URL to run a full SEO and AEO audit
        </p>
      </header>

      <section
        aria-label="URL intake"
        className="card-glow rounded-xl border border-border bg-card p-8"
      >
        <div className="mb-6 space-y-1">
          <h2 className="font-semibold">Website URL</h2>
          <p className="text-sm text-muted-foreground">
            We&apos;ll crawl your site, run 55+ SEO checks, and queue the results
            within minutes.
          </p>
        </div>

        <ScanFormWithDefault searchParamsPromise={searchParams} />
      </section>

      <section
        aria-label="What we check"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        {AUDIT_FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-border bg-card/50 p-4"
          >
            <p className="text-xs font-mono text-primary">{f.icon}</p>
            <p className="mt-2 text-sm font-medium">{f.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

// Async server component resolves searchParams before passing defaultUrl to client form
async function ScanFormWithDefault({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ url?: string }>;
}) {
  const { url } = await searchParamsPromise;
  return <ScanForm defaultUrl={url} />;
}

const AUDIT_FEATURES = [
  {
    icon: "◈",
    title: "55+ SEO Checks",
    description:
      "Meta tags, headings, canonical, structured data, Core Web Vitals, and more.",
  },
  {
    icon: "⊙",
    title: "AEO Intelligence",
    description:
      "See where your brand appears in ChatGPT, Perplexity, Gemini, and Claude.",
  },
  {
    icon: "⊛",
    title: "AI-Powered Fixes",
    description:
      "Quick fixes applied in one click. Major fixes flagged for human review.",
  },
] as const;
