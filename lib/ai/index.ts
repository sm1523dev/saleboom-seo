import type { AIProvider } from "./types";

function createProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "mock";

  switch (name) {
    case "azure":
      return new (require("./providers/azure").AzureAIProvider)();
    case "openai":
      return new (require("./providers/openai").OpenAIProvider)();
    case "anthropic":
      return new (require("./providers/anthropic").AnthropicAIProvider)();
    case "ollama":
      return new (require("./providers/ollama").OllamaAIProvider)();
    case "nim":
      return new (require("./providers/nim").NimAIProvider)();
    case "groq":
      return new (require("./providers/groq").GroqAIProvider)();
    case "mock":
      return new (require("./providers/mock").MockAIProvider)();
    default:
      throw new Error(
        `Unknown AI_PROVIDER: "${name}". Valid: azure, nim, openai, anthropic, ollama, groq, mock`
      );
  }
}

export const aiProvider: AIProvider = createProvider();
export type { AIProvider, GenerateOpts } from "./types";
