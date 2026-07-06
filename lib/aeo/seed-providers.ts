import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";

// Platform-managed global providers — all free, no user configuration needed.
// Groq: https://console.groq.com (free tier, OpenAI-compatible)
// Google: https://aistudio.google.com (free tier)
// 3 architecture families × 2 models each = 6 AEO signal sources.
// Covers Western AI, Google AI, and Asian AI ecosystems for broad brand visibility signal.
const GLOBAL_PROVIDERS = [
  // Family 1 — OpenAI GPT-OSS (Groq, free tier)
  {
    displayName: "GPT-OSS 120B (Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    displayName: "GPT-OSS 20B (Groq)",
    providerType: "openai-compat",
    endpointUrl: "https://api.groq.com/openai/v1",
    apiKeyEnvVar: "GROQ_API_KEY",
    model: "openai/gpt-oss-20b",
  },
  // Family 2 — Google Gemini (Google AI Studio, free tier)
  {
    displayName: "Gemini 2.0 Flash (Google)",
    providerType: "google",
    endpointUrl: null,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    model: "gemini-2.0-flash",
  },
  {
    displayName: "Gemini 1.5 Flash (Google)",
    providerType: "google",
    endpointUrl: null,
    apiKeyEnvVar: "GOOGLE_AI_API_KEY",
    model: "gemini-1.5-flash",
  },
  // Family 3 — Asian AI (NVIDIA NIM preview, free tier)
  // Kimi (Moonshot AI) + GLM (Zhipu AI) — represent Chinese/Asian AI ecosystem
  {
    displayName: "Kimi K2.6 (NVIDIA NIM)",
    providerType: "openai-compat",
    endpointUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "moonshotai/kimi-k2.6",
  },
  {
    displayName: "GLM 5.2 (NVIDIA NIM)",
    providerType: "openai-compat",
    endpointUrl: "https://integrate.api.nvidia.com/v1",
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "z-ai/glm-5.2",
  },
] as const;

const DEPRECATED_PROVIDER_NAMES = [
  "Qwen 3 32B (via Groq)",   // deprecated 2026-07-17 on Groq
  "Qwen 3.6 27B (via Groq)", // replaced by NVIDIA NIM Asian family
  "GPT-OSS 120B (via Groq)", // renamed — display name changed
  "GPT-OSS 20B (via Groq)",  // renamed — display name changed
];

export async function seedGlobalProviders(): Promise<void> {
  // Disable stale/renamed providers so they don't run in background AEO jobs
  if (DEPRECATED_PROVIDER_NAMES.length > 0) {
    await db
      .update(aeoProviders)
      .set({ enabled: false })
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
