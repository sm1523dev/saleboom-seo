import { z } from "zod";

export const AeoMentionSchema = z.object({
  platform: z.enum(["chatgpt", "perplexity", "gemini", "claude", "other"]),
  query: z.string().describe("The search query that surfaced this mention"),
  position: z.number().int().describe("Rank position in the answer (1-based)"),
  snippet: z.string().describe("Verbatim excerpt where the brand/domain appears"),
  sentiment: z.enum(["positive", "neutral", "negative"]),
});

export const AeoMentionsSchema = z.object({
  mentions: z.array(AeoMentionSchema),
});

export type AeoMention = z.infer<typeof AeoMentionSchema>;
export type AeoMentions = z.infer<typeof AeoMentionsSchema>;
