import { generateText, Output, embed } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

export class OpenAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly openai: any;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for AI_PROVIDER=openai");
    }
    const { createOpenAI } = require("@ai-sdk/openai");
    this.openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private getModel(override?: string) {
    return this.openai.chat(override ?? process.env.OPENAI_MODEL ?? "gpt-4o");
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
    const result = await embed({
      model: this.openai.embedding(process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small"),
      value: text,
    });
    return result.embedding;
  }
}
