import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";

// Platform-managed global providers — all free, no user configuration needed.
// Groq: https://console.groq.com (free tier, OpenAI-compatible)
// Google: https://aistudio.google.com (free tier)
const GLOBAL_PROVIDERS = [
  {
    displayName: "ChatGPT Style (Llama 3.3)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
  },
  {
    displayName: "Google Gemini",
    providerType: "google",
    endpointUrl: null,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    model: "gemini-1.5-flash",
  },
  {
    displayName: "Open Assistant (Mixtral)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "mixtral-8x7b-32768",
  },
  {
    displayName: "Meta AI (Llama 3.1)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "llama-3.1-8b-instant",
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
