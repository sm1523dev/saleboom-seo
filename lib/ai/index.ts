import type { AIProvider } from "./types";
import { resolveInfraProvider } from "@/lib/providers/resolver";

function createFromEnv(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "mock";
  return createByName(name, undefined, {});
}

function createByName(name: string, apiKey: string | undefined, config: Record<string, string>): AIProvider {
  switch (name) {
    case "azure":
      return new (require("./providers/azure").AzureAIProvider)(apiKey);
    case "openai":
      return new (require("./providers/openai").OpenAIProvider)(apiKey);
    case "anthropic":
      return new (require("./providers/anthropic").AnthropicAIProvider)(apiKey);
    case "ollama":
      return new (require("./providers/ollama").OllamaAIProvider)(apiKey, config);
    case "nim":
      return new (require("./providers/nim").NimAIProvider)(apiKey, config);
    case "groq":
      return new (require("./providers/groq").GroqAIProvider)(apiKey);
    case "custom":
      return new (require("./providers/custom").CustomAIProvider)(apiKey, config);
    case "mock":
      return new (require("./providers/mock").MockAIProvider)();
    default:
      throw new Error(`Unknown AI provider: "${name}". Valid: azure, nim, openai, anthropic, ollama, groq, custom, mock`);
  }
}

export async function getAiProvider(): Promise<AIProvider> {
  const resolved = await resolveInfraProvider("ai");
  if (resolved) return createByName(resolved.name, resolved.key, resolved.config);
  return createFromEnv();
}

export type { AIProvider, GenerateOpts } from "./types";
