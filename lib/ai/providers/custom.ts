import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

// Generic OpenAI-compatible provider — works with any endpoint that speaks the OpenAI API.
// Covers: OpenRouter, Together AI, Groq, Mistral, any NIM-like or LiteLLM proxy, etc.
export class CustomAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly openai: any;
  private readonly _model: string;

  constructor(apiKey?: string, config?: Record<string, string>) {
    const key = apiKey ?? process.env.CUSTOM_AI_API_KEY;
    const baseURL = config?.endpointUrl ?? process.env.CUSTOM_AI_ENDPOINT_URL;
    if (!key) throw new Error("API key required for custom AI provider — set it via admin UI");
    if (!baseURL) throw new Error("Endpoint URL required for custom AI provider — set it via admin UI");
    const { createOpenAI } = require("@ai-sdk/openai");
    this.openai = createOpenAI({ baseURL, apiKey: key });
    this._model = config?.model ?? process.env.CUSTOM_AI_MODEL ?? "gpt-4o";
  }

  private getModel(override?: string) {
    return this.openai(override ?? this._model);
  }

  async generateStructured<T>(schema: z.ZodSchema<T>, prompt: string, opts?: GenerateOpts): Promise<T> {
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

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new Error("Use AI_PROVIDER=openai for embeddings.");
  }
}
