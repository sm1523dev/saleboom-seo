import type { AIProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";
import { AzureAIProvider } from "./providers/azure";
import { OpenAIProvider } from "./providers/openai";
import { AnthropicAIProvider } from "./providers/anthropic";
import { OllamaAIProvider } from "./providers/ollama";
import { NimAIProvider } from "./providers/nim";
import { GroqAIProvider } from "./providers/groq";
import { CustomAIProvider } from "./providers/custom";
import { MockAIProvider } from "./providers/mock";

function createFromEnv(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "mock";
  return createByName(name, undefined, {});
}

function createByName(
  name: string,
  apiKey: string | undefined,
  config: Record<string, string>,
): AIProvider {
  switch (name) {
    case "azure":
      return new AzureAIProvider(apiKey, config);
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicAIProvider();
    case "ollama":
      return new OllamaAIProvider();
    case "nim":
      return new NimAIProvider(apiKey, config);
    case "groq":
      return new GroqAIProvider();
    case "custom":
      return new CustomAIProvider(apiKey, config);
    case "mock":
      return new MockAIProvider();
    default:
      throw new Error(
        `Unknown AI provider: "${name}". Valid: azure, nim, openai, anthropic, ollama, groq, custom, mock`,
      );
  }
}

export async function getAiProvider(): Promise<AIProvider> {
  const resolved = await resolveInfraProvider("ai");
  if (resolved) return createByName(resolved.name, resolved.key, resolved.config);
  return createFromEnv();
}

export type { AIProvider, GenerateOpts } from "./types";
