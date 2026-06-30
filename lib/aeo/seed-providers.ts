import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";

// Platform-managed global providers — all free, no user configuration needed.
// Groq: https://console.groq.com (free tier, OpenAI-compatible)
// Google: https://aistudio.google.com (free tier)
const GLOBAL_PROVIDERS = [
  {
    displayName: "GPT-OSS 120B (via Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    displayName: "GPT-OSS 20B (via Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-20b",
  },
  {
    displayName: "Qwen 3.6 27B (via Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "qwen/qwen3.6-27b",
  },
  {
    displayName: "Qwen 3 32B (via Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "qwen/qwen3-32b",
  },
] as const;

export async function seedGlobalProviders(): Promise<void> {
  for (const p of GLOBAL_PROVIDERS) {
    await db
      .insert(aeoProviders)
      .values({ ...p, enabled: true })
      .onConflictDoNothing();
  }
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

  if (existing.length > 0) return;

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
