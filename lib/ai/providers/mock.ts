import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

export class MockAIProvider implements AIProvider {
  async generateStructured<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    opts?: GenerateOpts
  ): Promise<T> {
    console.log("[ai:mock] generateStructured", {
      system: opts?.system,
      prompt: prompt.slice(0, 80),
    });
    // Use safeParse on an empty object and return a best-effort fallback.
    // Avoids coupling to Zod's private _def API.
    const attempt = schema.safeParse({});
    if (attempt.success) return attempt.data;

    // If empty object fails validation, try null — schema will reject and we
    // surface a clear error so developers know the mock needs a fixture.
    throw new Error(
      `[ai:mock] Cannot auto-generate mock data for this schema. ` +
        `Add a fixture to MockAIProvider or use AI_PROVIDER=ollama locally.`
    );
  }

  async generateText(prompt: string, _opts?: GenerateOpts): Promise<string> {
    console.log("[ai:mock] generateText", { prompt: prompt.slice(0, 80) });
    return "[mock AI response]";
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    return new Array(1536).fill(0);
  }
}
