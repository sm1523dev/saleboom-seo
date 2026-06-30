import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";
import type { AeoProviderType } from "./types";

type SeedRow = {
  displayName: string;
  providerType: AeoProviderType;
  endpointUrl: string | null;
  model: string;
};

const DEFAULT_PROVIDERS: SeedRow[] = [
  {
    displayName: "ChatGPT (GPT-4o)",
    providerType: "openai-compat",
    endpointUrl: null,
    model: "gpt-4o",
  },
  {
    displayName: "Claude Sonnet 4.6",
    providerType: "anthropic",
    endpointUrl: null,
    model: "claude-sonnet-4-6",
  },
  {
    displayName: "Gemini 1.5 Pro",
    providerType: "google",
    endpointUrl: null,
    model: "gemini-1.5-pro",
  },
  {
    displayName: "Perplexity Sonar",
    providerType: "perplexity",
    endpointUrl: null,
    model: "sonar",
  },
];

export async function seedDefaultProviders(websiteId: string): Promise<void> {
  const rows = DEFAULT_PROVIDERS.map((p) => ({
    websiteId,
    displayName: p.displayName,
    providerType: p.providerType,
    endpointUrl: p.endpointUrl,
    apiKeyEncrypted: null, // use platform-managed env keys
    model: p.model,
    enabled: true,
  }));

  // Skip providers whose env key is missing — they will be ignored at query time
  await db.insert(aeoProviders).values(rows).onConflictDoNothing();
}

export async function seedDefaultQueries(
  websiteId: string,
  websiteName: string,
  websiteUrl: string
): Promise<void> {
  const existing = await db
    .select({ id: aeoQueries.id })
    .from(aeoQueries)
    .where(eq(aeoQueries.websiteId, websiteId))
    .limit(1);

  if (existing.length > 0) return; // already seeded

  let domain = websiteUrl;
  try { domain = new URL(websiteUrl).hostname.replace(/^www\./, ""); } catch { /* keep raw */ }

  const prompts = [
    `Tell me about ${websiteName}`,
    `What is ${domain} and what do they offer?`,
    `Best alternatives to ${websiteName}`,
  ];

  await db.insert(aeoQueries).values(
    prompts.map((promptText) => ({ websiteId, promptText, active: true }))
  );
}
