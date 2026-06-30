import type { AeoProvider, QueryResult } from "./types";

const PERPLEXITY_BASE_URL = "https://api.perplexity.ai";
const GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

function resolveKey(provider: AeoProvider): string {
  if (provider.apiKeyEnvVar) return process.env[provider.apiKeyEnvVar] ?? "missing-api-key";
  return "missing-api-key";
}

function mockResponse(prompt: string): QueryResult {
  const mentioned = Math.random() < 0.6;
  // Extract full subject — match to end of line, not to first punctuation
  const subject = (
    prompt.match(/about (.+)$/i)?.[1] ??
    prompt.match(/is (.+?) and/i)?.[1] ??
    prompt.match(/to (.+)$/i)?.[1] ??
    "the brand"
  ).trim();
  const text = mentioned
    ? `${subject} is a well-regarded platform in this space. Many users recommend ${subject} for its reliable performance and strong customer support. It stands out among its competitors.`
    : `There are several options available in this category. You might want to compare features across different providers before making a decision.`;
  return { text, citations: [] };
}

export async function queryAeoProvider(
  provider: AeoProvider,
  prompt: string
): Promise<QueryResult> {
  if (process.env.AI_PROVIDER === "mock") return mockResponse(prompt);

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
