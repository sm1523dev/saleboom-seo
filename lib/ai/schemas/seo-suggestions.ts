import { z } from "zod";

export const SeoSuggestionsSchema = z.object({
  metaTitle: z.string().describe("Optimised page title (50-60 chars)"),
  metaDescription: z.string().describe("Optimised meta description (150-160 chars, includes primary keyword)"),
  h1: z.string().describe("Primary heading for the page (concise, keyword-rich)"),
});

export type SeoSuggestions = z.infer<typeof SeoSuggestionsSchema>;
