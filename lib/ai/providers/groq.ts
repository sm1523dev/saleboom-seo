import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
// Best available Groq model for structured generation
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export class GroqAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly openai: any;

  constructor() {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is required for AI_PROVIDER=groq");
    }
    const { createOpenAI } = require("@ai-sdk/openai");
    this.openai = createOpenAI({
      baseURL: GROQ_BASE_URL,
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  private getModel(override?: string) {
    return this.openai(override ?? process.env.GROQ_MODEL ?? DEFAULT_MODEL);
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
    throw new Error("Groq does not support embeddings. Use AI_PROVIDER=openai for embeddings.");
  }
}
