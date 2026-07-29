import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";

// Platform-managed global providers — all free, no user configuration needed.
// Groq: https://console.groq.com (free tier, OpenAI-compatible, LPU hardware = 1–3s responses)
// NIM (NVIDIA) was previously used but 80B–122B models exceeded Azure Function 10-min limit.
// Groq hosts the same model weights (GPT-OSS, Llama, Qwen, Mixtral) at ~100× the speed.
const GROQ = "https://api.groq.com/openai/v1";

const GLOBAL_PROVIDERS = [
  // OpenAI open-source models via Groq
  {
    displayName: "GPT-OSS 120B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    displayName: "GPT-OSS 20B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-20b",
  },
  // Meta Llama family
  {
    displayName: "Llama 3.3 70B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "llama-3.3-70b-versatile",
  },
  {
    displayName: "Llama 3.1 70B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "llama-3.1-70b-versatile",
  },
  // Qwen reasoning model
  {
    displayName: "Qwen QwQ 32B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "qwen-qwq-32b",
  },
  // Mixtral (Mistral)
  {
    displayName: "Mixtral 8x7B (Groq)",
    providerType: "openai-compat",
    endpointUrl: GROQ,
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "mixtral-8x7b-32768",
  },
] as const;

const DEPRECATED_PROVIDER_NAMES = [
  // old Groq names
  "Qwen 3 32B (via Groq)",
  "Qwen 3.6 27B (via Groq)",
  "GPT-OSS 120B (via Groq)",
  "GPT-OSS 20B (via Groq)",
  // old Google
  "Gemini 2.0 Flash (Google)",
  "Gemini 1.5 Flash (Google)",
  // NVIDIA NIM models being replaced
  "Kimi K2.6 (NVIDIA NIM)",
  "GLM 5.2 (NVIDIA NIM)",
  "GPT-OSS 120B (NIM)",
  "GPT-OSS 20B (NIM)",
  "Qwen 3.5 122B (NIM)",
  "Qwen 3 Next 80B (NIM)",
  "Kimi K2.6 (NIM)",
  "GLM 5.2 (NIM)",
];

export async function seedGlobalProviders(): Promise<void> {
  // Delete stale/renamed providers — they are gone from the active config
  if (DEPRECATED_PROVIDER_NAMES.length > 0) {
    await db
      .delete(aeoProviders)
      .where(inArray(aeoProviders.displayName, [...DEPRECATED_PROVIDER_NAMES]));
  }

  for (const p of GLOBAL_PROVIDERS) {
    await db
      .insert(aeoProviders)
      .values({ ...p, enabled: true })
      .onConflictDoUpdate({
        target: aeoProviders.displayName,
        set: { enabled: true, model: p.model, endpointUrl: p.endpointUrl, apiKeyEnvVar: p.apiKeyEnvVar },
      });
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
