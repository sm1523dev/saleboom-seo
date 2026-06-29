import { generateText, Output } from "ai";
import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

// Ollama runs locally — free, no API key needed.
// Install: https://ollama.ai — then: ollama pull llama3.2
export class OllamaAIProvider implements AIProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly ollama: any;

  constructor() {
    const { createOllama } = require("ollama-ai-provider");
    this.ollama = createOllama({
      baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api",
    });
  }

  private getModel(override?: string) {
    return this.ollama(override ?? process.env.OLLAMA_MODEL ?? "llama3.2");
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
    const result = await fetch(
      `${process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/embeddings`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text",
          prompt: text,
        }),
      }
    );
    if (!result.ok) throw new Error(`Ollama embeddings error: ${result.status}`);
    const json = await result.json();
    return json.embedding as number[];
  }
}
