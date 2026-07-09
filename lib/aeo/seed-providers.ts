import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { aeoProviders, aeoQueries } from "@/lib/db/schema";

// Platform-managed global providers — all free, no user configuration needed.
// Groq: https://console.groq.com (free tier, OpenAI-compatible)
// Google: https://aistudio.google.com (free tier)
// 3 architecture families × 2 models each = 6 AEO signal sources.
// All via NVIDIA NIM (single API key). Covers Western, Alibaba/Qwen, and Asian AI ecosystems.
const NIM = "https://integrate.api.nvidia.com/v1";

const GLOBAL_PROVIDERS = [
  // Family 1 — OpenAI GPT-OSS (via NVIDIA NIM)
  {
    displayName: "GPT-OSS 120B (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "openai/gpt-oss-120b",
  },
  {
    displayName: "GPT-OSS 20B (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "openai/gpt-oss-20b",
  },
  // Family 2 — Qwen/Alibaba (via NVIDIA NIM)
  {
    displayName: "Qwen 3.5 122B (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "qwen/qwen3.5-122b-a10b",
  },
  {
    displayName: "Qwen 3 Next 80B (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "qwen/qwen3-next-80b-a3b-instruct",
  },
  // Family 3 — Asian AI: Kimi (Moonshot) + GLM (Zhipu) via NVIDIA NIM
  {
    displayName: "Kimi K2.6 (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "moonshotai/kimi-k2.6",
  },
  {
    displayName: "GLM 5.2 (NIM)",
    providerType: "openai-compat",
    endpointUrl: NIM,
    apiKeyEnvVar: "NVIDIA_NIM_API_KEY",
    model: "z-ai/glm-5.2",
  },
] as const;

const DEPRECATED_PROVIDER_NAMES = [
  "Qwen 3 32B (via Groq)",
  "Qwen 3.6 27B (via Groq)",
  "GPT-OSS 120B (via Groq)",
  "GPT-OSS 20B (via Groq)",
  "GPT-OSS 120B (Groq)",
  "GPT-OSS 20B (Groq)",
  "Gemini 2.0 Flash (Google)",
  "Gemini 1.5 Flash (Google)",
  "Kimi K2.6 (NVIDIA NIM)",
  "GLM 5.2 (NVIDIA NIM)",
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
