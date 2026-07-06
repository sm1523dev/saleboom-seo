import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

const NIM_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "openai/gpt-oss-120b";

export class NimAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly openai: any;

  constructor() {
    if (!process.env.NVIDIA_NIM_API_KEY) {
      throw new Error("NVIDIA_NIM_API_KEY is required for AI_PROVIDER=nim");
    }
    const { createOpenAI } = require("@ai-sdk/openai");
    this.openai = createOpenAI({
      baseURL: NIM_BASE_URL,
      apiKey: process.env.NVIDIA_NIM_API_KEY,
    });
  }

  private getModel(override?: string) {
    return this.openai(override ?? process.env.NIM_MODEL ?? DEFAULT_MODEL);
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
    throw new Error("Use AI_PROVIDER=openai for embeddings.");
  }
}
