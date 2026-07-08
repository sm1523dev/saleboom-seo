import { requireAdmin } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { aeoProviders } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import { AeoProviderList } from "./_components/aeo-provider-list";

export const metadata = { title: "Provider Management" };

const ADAPTER_CARDS = [
  { label: "AI / LLM", icon: "⊛" },
  { label: "Web Crawl", icon: "⊙" },
  { label: "Queue / Worker", icon: "⊞" },
  { label: "Storage", icon: "⊟" },
  { label: "Notifications", icon: "⊡" },
  { label: "Auth", icon: "⊕" },
] as const;

function resolveAdapterCards() {
  return [
    {
      label: "AI / LLM",
      icon: "⊛",
      provider: process.env.AI_PROVIDER ?? "mock",
      detail:
        process.env.AZURE_OPENAI_DEPLOYMENT ??
        process.env.GROQ_MODEL ??
        "—",
    },
    {
      label: "Web Crawl",
      icon: "⊙",
      provider: process.env.CRAWL_PROVIDER ?? "mock",
      detail: process.env.FIRECRAWL_API_URL ?? "cloud",
    },
    {
      label: "Queue / Worker",
      icon: "⊞",
      provider: process.env.QUEUE_PROVIDER ?? "mock",
      detail: process.env.REDIS_URL
        ? "redis configured"
        : process.env.AZURE_STORAGE_CONNECTION_STRING
          ? "azure configured"
          : "—",
    },
    {
      label: "Storage",
      icon: "⊟",
      provider: process.env.STORAGE_PROVIDER ?? "local",
      detail: process.env.AZURE_STORAGE_CONTAINER ?? "local filesystem",
    },
    {
      label: "Notifications",
      icon: "⊡",
      provider: process.env.NOTIFICATION_PROVIDER ?? "mock",
      detail: "email + WhatsApp",
    },
    {
      label: "Auth",
      icon: "⊕",
      provider: process.env.AUTH_PROVIDER ?? "mock",
      detail: "OAuth providers via env",
    },
  ] satisfies Array<{ label: string; icon: string; provider: string; detail: string }>;
}

export default async function ProvidersPage() {
  await requireAdmin();

  const providers = await db
    .select()
    .from(aeoProviders)
    .orderBy(asc(aeoProviders.displayName));

  const adapterCards = resolveAdapterCards();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provider Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure infrastructure adapters and AI providers.
        </p>
      </div>

      {/* Infrastructure adapters — read-only, env-driven */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
          Infrastructure Adapters
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adapterCards.map((item) => (
            <div
              key={item.label}
              className="card-glow rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">{item.icon}</span>
                <p className="text-sm font-semibold">{item.label}</p>
              </div>
              <p className="mt-2 font-mono text-xs text-primary">{item.provider}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              <p className="mt-3 text-[10px] text-muted-foreground/50">
                Runtime switching via env var · redeploy to change
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* AEO providers — DB-backed, live toggle */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
            AEO Query Providers
          </h2>
          <span className="text-xs text-muted-foreground">
            {providers.filter((p) => p.enabled).length} of {providers.length} active
          </span>
        </div>
        <AeoProviderList providers={providers} />
      </section>
    </div>
  );
}
