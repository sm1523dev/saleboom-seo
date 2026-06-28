import { generateText, Output } from "ai";
import type { z } from "zod";
import { getModel } from "./client";

type GenerateStructuredOpts = {
  system?: string;
  deploymentId?: string;
};

export async function generateStructured<T>(
  schema: z.ZodSchema<T>,
  prompt: string,
  opts?: GenerateStructuredOpts
): Promise<T> {
  const model = getModel(opts?.deploymentId);

  const result = await generateText({
    model,
    output: Output.object({ schema }),
    system: opts?.system,
    prompt,
  });

  return result.output as T;
}
