import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";
import { logger } from "@/lib/logger";

// Domain extracted from "Page URL: https://example.com/path" in the prompt
function extractDomain(prompt: string): string {
  const match = prompt.match(/Page URL:\s*(https?:\/\/([^/\s]+))/);
  return match?.[2] ?? "example.com";
}

export class MockAIProvider implements AIProvider {
  async generateStructured<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    _opts?: GenerateOpts
  ): Promise<T> {
    const domain = extractDomain(prompt);
    // Return a realistic-looking stub that satisfies the SeoSuggestionSchema
    const stub = {
      metaTitle: `${domain} — Professional Services & Solutions`,
      metaDescription: `Discover what ${domain} offers. Trusted by thousands of users. Get started today and see the difference for yourself.`,
      h1: `Welcome to ${domain}`,
    };
    const result = schema.safeParse(stub);
    if (result.success) return result.data;
    // Schema doesn't match SeoSuggestions — return empty object and log
    logger.warn("[ai:mock] schema mismatch — returning empty object");
    return {} as T;
  }

  async generateText(_prompt: string, _opts?: GenerateOpts): Promise<string> {
    return "[mock AI response]";
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return new Array(1536).fill(0);
  }
}
