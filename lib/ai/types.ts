import type { z } from "zod";

export type GenerateOpts = {
  system?: string;
  temperature?: number;
  maxTokens?: number;
  modelOverride?: string;
};

export interface AIProvider {
  generateStructured<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    opts?: GenerateOpts
  ): Promise<T>;

  generateText(prompt: string, opts?: GenerateOpts): Promise<string>;

  generateEmbedding(text: string): Promise<number[]>;
}
