import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

export class AnthropicAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly anthropic: any;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is required for AI_PROVIDER=anthropic");
    }
    const { createAnthropic } = require("@ai-sdk/anthropic");
    this.anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  private getModel(override?: string) {
    return this.anthropic(override ?? process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6");
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

  async generateEmbedding(_text: string): Promise<number[]> {
    throw new Error(
      "Anthropic does not support embeddings. Use AI_PROVIDER=openai or AI_PROVIDER=azure for embeddings."
    );
  }
}
