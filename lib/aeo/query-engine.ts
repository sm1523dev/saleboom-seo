import type { AeoProvider, QueryResult } from "./types";

const PROVIDER_ENV_KEYS: Record<string, string> = {
  "openai-compat": "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_AI_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
// Google exposes an OpenAI-compatible endpoint — no extra SDK needed
const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function resolveKey(provider: AeoProvider): string {
  if (provider.apiKeyEncrypted) return provider.apiKeyEncrypted;
  const envKey = PROVIDER_ENV_KEYS[provider.providerType];
  return (envKey ? process.env[envKey] : undefined) ?? "missing-api-key";
}

export async function queryAeoProvider(
  provider: AeoProvider,
  prompt: string
): Promise<QueryResult> {
  const { generateText } = await import("ai");

  if (provider.providerType === "anthropic") {
    const { createAnthropic } = await import("@ai-sdk/anthropic");
    const client = createAnthropic({ apiKey: resolveKey(provider) });
    const { text } = await generateText({ model: client(provider.model), prompt });
    return { text, citations: [] };
  }

  // openai-compat, perplexity, and google all use the OpenAI-compatible path
  const { createOpenAI } = await import("@ai-sdk/openai");
  const baseURL =
    provider.providerType === "perplexity"
      ? PERPLEXITY_BASE_URL
      : provider.providerType === "google"
        ? GOOGLE_BASE_URL
        : (provider.endpointUrl ?? undefined);

  const openai = createOpenAI({ baseURL, apiKey: resolveKey(provider) });
  const result = await generateText({ model: openai(provider.model), prompt });

  // Perplexity returns source URLs in experimental_providerMetadata
  const meta = (result as unknown as Record<string, unknown>)
    .experimental_providerMetadata as
    | { perplexity?: { sources?: Array<{ url?: string }> } }
    | undefined;
  const citations =
    meta?.perplexity?.sources
      ?.map((s) => s.url)
      .filter((u): u is string => !!u) ?? [];

  return { text: result.text, citations };
}
