import { createAzure } from "@ai-sdk/azure";
import type { LanguageModelV4 } from "@ai-sdk/provider";

const azure = createAzure({
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
});

export function getModel(deploymentId?: string): LanguageModelV4 {
  const id = deploymentId ?? process.env.AZURE_OPENAI_DEPLOYMENT;
  if (!id) throw new Error("AZURE_OPENAI_DEPLOYMENT is not set");
  return azure.chat(id);
}
