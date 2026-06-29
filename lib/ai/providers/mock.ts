import type { z } from "zod";
import type { AIProvider, GenerateOpts } from "../types";

export class MockAIProvider implements AIProvider {
  async generateStructured<T>(
    schema: z.ZodSchema<T>,
    prompt: string,
    opts?: GenerateOpts
  ): Promise<T> {
    console.log("[ai:mock] generateStructured", { system: opts?.system, prompt: prompt.slice(0, 80) });
    // Return the schema's default/sample value by parsing an empty object
    // and letting Zod fill in defaults, or return minimal valid data
    return schema.parse(buildMinimalValue(schema)) as T;
  }

  async generateText(prompt: string, _opts?: GenerateOpts): Promise<string> {
    console.log("[ai:mock] generateText", { prompt: prompt.slice(0, 80) });
    return "[mock AI response]";
  }

  async generateEmbedding(_text: string): Promise<number[]> {
    // Return a deterministic 1536-dim zero vector for mock
    return new Array(1536).fill(0);
  }
}

function buildMinimalValue(schema: z.ZodSchema): unknown {
  // Introspect the schema to build a minimal valid object
  const def = (schema as unknown as { _def: { typeName: string; shape?: () => Record<string, z.ZodSchema> } })._def;
  if (def.typeName === "ZodObject" && def.shape) {
    const result: Record<string, unknown> = {};
    for (const [key, fieldSchema] of Object.entries(def.shape())) {
      result[key] = buildMinimalValue(fieldSchema as z.ZodSchema);
    }
    return result;
  }
  if (def.typeName === "ZodString") return "[mock]";
  if (def.typeName === "ZodNumber") return 0;
  if (def.typeName === "ZodBoolean") return false;
  if (def.typeName === "ZodArray") return [];
  if (def.typeName === "ZodEnum") {
    const values = (def as unknown as { values: string[] }).values;
    return values[0];
  }
  return null;
}
