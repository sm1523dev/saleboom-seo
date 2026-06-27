import { ScrollReveal } from "@/components/animations/scroll-reveal";

const FEATURES = [
  {
    eyebrow: "SEO Audit",
    title: "50+ checks. Under 60 seconds.",
    description:
      "Broken links, missing meta, slow pages, thin content — every technical and content failure surfaced in a single ranked report. No crawlers to configure, no waiting overnight.",
    stat: { value: "50+", label: "automated checks" },
    ariaLabel: "SEO Audit feature — 50+ automated checks",
  },
  {
    eyebrow: "AEO Intelligence",
    title: "Get cited by the AI engines replacing search.",
    description:
      "Perplexity, ChatGPT, Gemini, Bing Copilot — they answer questions from a small pool of trusted sources. AEO Intelligence tells you exactly what it takes to get in that pool.",
    stat: { value: "4", label: "AI platforms tracked" },
    ariaLabel: "AEO Intelligence feature — 4 AI platform optimization",
  },
  {
    eyebrow: "CMS Push",
    title: "One click to publish. One click to roll back.",
    description:
      "Push SEO and AEO fixes directly to your CMS. No copy-paste, no developer required. If a change tanks your metrics, revert instantly.",
    stat: { value: "1-click", label: "rollback" },
    ariaLabel: "CMS Push feature — direct publishing with rollback",
  },
] as const;

export function FeatureSections() {
  return (
    <section aria-label="Features" className="px-4 py-24">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Wide card — first feature */}
        <ScrollReveal>
          <article
            className="card-glow grid grid-cols-1 gap-8 rounded-xl border border-border bg-card p-8 md:grid-cols-2 md:items-center"
            aria-label={FEATURES[0].ariaLabel}
          >
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                <span className="text-primary">{FEATURES[0].eyebrow} — </span>
                {FEATURES[0].title}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {FEATURES[0].description}
              </p>
            </div>
            <div className="flex items-end justify-start md:justify-end">
              <div className="space-y-1">
                <p className="font-mono text-5xl font-bold text-foreground">
                  {FEATURES[0].stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{FEATURES[0].stat.label}</p>
              </div>
            </div>
          </article>
        </ScrollReveal>

        {/* Two-column — second and third features */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
          <ScrollReveal delay={0.05} className="md:col-span-3">
            <article
              className="card-glow flex h-full flex-col justify-between gap-8 rounded-xl border border-border bg-card p-8"
              aria-label={FEATURES[1].ariaLabel}
            >
              <div className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  <span className="text-primary">{FEATURES[1].eyebrow} — </span>
                  {FEATURES[1].title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {FEATURES[1].description}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-4xl font-bold text-foreground">
                  {FEATURES[1].stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{FEATURES[1].stat.label}</p>
              </div>
            </article>
          </ScrollReveal>

          <ScrollReveal delay={0.1} className="md:col-span-2">
            <article
              className="card-glow flex h-full flex-col justify-between gap-8 rounded-xl border border-border bg-card p-8"
              aria-label={FEATURES[2].ariaLabel}
            >
              <div className="space-y-3">
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  <span className="text-primary">{FEATURES[2].eyebrow} — </span>
                  {FEATURES[2].title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {FEATURES[2].description}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-4xl font-bold text-foreground">
                  {FEATURES[2].stat.value}
                </p>
                <p className="text-sm text-muted-foreground">{FEATURES[2].stat.label}</p>
              </div>
            </article>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
