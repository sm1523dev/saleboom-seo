import { createAzure } from "@ai-sdk/azure";
import { generateText, Output, embed } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

export class AzureAIProvider implements AIProvider {
  private readonly azure: ReturnType<typeof createAzure>;
  private readonly defaultDeployment: string;

  constructor() {
    if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY) {
      throw new Error(
        "AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY are required for AI_PROVIDER=azure"
      );
    }
    if (!process.env.AZURE_OPENAI_DEPLOYMENT) {
      throw new Error("AZURE_OPENAI_DEPLOYMENT is required for AI_PROVIDER=azure");
    }

    this.azure = createAzure({
      baseURL: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    });

    this.defaultDeployment = process.env.AZURE_OPENAI_DEPLOYMENT;
  }

  private getModel(override?: string) {
    return this.azure.chat(override ?? this.defaultDeployment);
  }

  async generateStructured<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    opts?: GenerateOpts
  ): Promise<T> {
    const result = await generateText({
      model: this.getModel(opts?.modelOverride),
      output: Output.object({ schema }),
      system: opts?.system,
      prompt,
      temperature: opts?.temperature,
      maxOutputTokens: opts?.maxTokens,
    });
    return result.output as T;
  }

  async generateText(prompt: string, opts?: GenerateOpts): Promise<string> {
    const result = await generateText({
      model: this.getModel(opts?.modelOverride),
      system: opts?.system,
      prompt,
      temperature: opts?.temperature,
      maxOutputTokens: opts?.maxTokens,
    });
    return result.text;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const embeddingDeployment =
      process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-ada-002";

    const result = await embed({
      model: this.azure.embedding(embeddingDeployment),
      value: text,
    });
    return result.embedding;
  }
}
