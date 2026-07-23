import { eq, asc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-utils";
import { db } from "@/lib/db";
import { aeoProviders, infraProviders } from "@/lib/db/schema";
import { AeoProviderList } from "./_components/aeo-provider-list";
import { InfraProviderCard } from "./_components/infra-provider-card";

export const metadata = { title: "Provider Management" };

const INFRA_META: Record<string, { label: string; icon: string; switchMode: "runtime" | "restart" | "redeploy" }> = {
  ai:            { label: "AI / LLM",        icon: "⊛", switchMode: "runtime"  },
  crawl:         { label: "Web Crawl",        icon: "⊙", switchMode: "runtime"  },
  queue:         { label: "Queue / Worker",   icon: "⊞", switchMode: "restart"  },
  storage:       { label: "Storage",          icon: "⊟", switchMode: "restart"  },
  notifications: { label: "Notifications",    icon: "⊡", switchMode: "runtime"  },
};

const AUTH_CARD = {
  label: "Auth",
  icon: "⊕",
  provider: "authjs",
  detail: "OAuth providers via env",
  switchMode: "redeploy" as const,
};

const PROVIDER_OPTIONS: Record<string, string[]> = {
  ai:            ["nim", "openai", "azure", "anthropic", "ollama", "groq", "custom", "mock"],
  crawl:         ["firecrawl", "mock"],
  queue:         ["bullmq", "azure-queue", "sqs", "mock"],
  storage:       ["local", "azure-blob", "s3", "mock"],
  notifications: ["resend", "sendgrid", "twilio", "ses", "mock"],
};

const ENV_PROVIDER_DEFAULTS: Record<string, string> = {
  ai:            process.env.AI_PROVIDER            ?? "mock",
  crawl:         process.env.CRAWL_PROVIDER         ?? "mock",
  queue:         process.env.QUEUE_PROVIDER         ?? "mock",
  storage:       process.env.STORAGE_PROVIDER       ?? "mock",
  notifications: process.env.NOTIFICATION_PROVIDER  ?? "mock",
};

export default async function ProvidersPage() {
  await requireAdmin();

  const [infraRows, aeoRows] = await Promise.all([
    db.select().from(infraProviders),
    db.select().from(aeoProviders).orderBy(asc(aeoProviders.displayName)),
  ]);

  const infraByType = Object.fromEntries(infraRows.map((r) => [r.type, r]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Provider Management</h1>
        <p className="text-sm text-muted-foreground">
          Configure infrastructure adapters and AI providers. Keys are encrypted in the database.
        </p>
      </div>

      {/* Infra adapters — DB-backed, editable */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
          Infrastructure Adapters
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.entries(INFRA_META) as [string, typeof INFRA_META[string]][]).map(([type, meta]) => {
            const row = infraByType[type];
            return (
              <InfraProviderCard
                key={type}
                type={type as "ai" | "crawl" | "queue" | "storage" | "notifications"}
                label={meta.label}
                icon={meta.icon}
                currentName={row?.name ?? ENV_PROVIDER_DEFAULTS[type] ?? "mock"}
                hasKey={!!row?.encryptedKeyBlob}
                switchMode={meta.switchMode}
                options={PROVIDER_OPTIONS[type] ?? []}
                config={(row?.config ?? {}) as Record<string, string>}
              />
            );
          })}

          {/* Auth — always env-driven, read-only */}
          <div className="card-glow rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-primary">{AUTH_CARD.icon}</span>
                <p className="text-sm font-semibold">{AUTH_CARD.label}</p>
              </div>
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                redeploy
              </span>
            </div>
            <p className="mt-2 font-mono text-xs text-primary">{AUTH_CARD.provider}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{AUTH_CARD.detail}</p>
            <p className="mt-3 text-[10px] text-muted-foreground/40">
              NextAuth compiles at build time — requires redeploy to switch
            </p>
          </div>
        </div>
      </section>

      {/* AEO query providers */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground/60">
            AEO Query Providers
          </h2>
          <span className="text-xs text-muted-foreground">
            {aeoRows.filter((p) => p.enabled).length} of {aeoRows.length} active
          </span>
        </div>
        <AeoProviderList providers={aeoRows} />
      </section>
    </div>
  );
}
