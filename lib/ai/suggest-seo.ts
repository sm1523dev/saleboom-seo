import { aiProvider } from "@/lib/ai";
import { logger } from "@/lib/logger";
import { SeoSuggestionsSchema, type SeoSuggestions } from "./schemas/seo-suggestions";
import type { ParsedPage } from "@/lib/seo-rules/types";

export interface SeoSuggestionResult {
  pageUrl: string;
  suggestion: SeoSuggestions;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
}

export async function generateSeoSuggestion(
  page: ParsedPage,
  scanId: string
): Promise<SeoSuggestionResult | null> {
  const start = performance.now();

  const prompt = buildPrompt(page);

  try {
    const suggestion = await aiProvider.generateStructured(SeoSuggestionsSchema, prompt, {
      system:
        "You are an expert SEO copywriter. Given a web page's current metadata and content, " +
        "return improved meta title, meta description, and H1. " +
        "Be specific, factual, and keyword-focused. Never use vague filler phrases.",
    });

    const latencyMs = Math.round(performance.now() - start);

    logger.ai("call", {
      model: process.env.AI_PROVIDER ?? "mock",
      latencyMs,
      scanId,
    });

    return { pageUrl: page.url, suggestion, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    logger.ai("error", {
      model: process.env.AI_PROVIDER ?? "mock",
      latencyMs,
      scanId,
    });
    logger.warn("AI suggestion failed", { url: page.url, error: String(err) });
    return null;
  }
}

function buildPrompt(page: ParsedPage): string {
  const current = {
    url: page.url,
    title: page.title ?? "(missing)",
    description: page.description ?? "(missing)",
    h1: page.h1s[0] ?? "(missing)",
    wordCount: page.wordCount,
    h2s: page.h2s.slice(0, 3).join(", ") || "(none)",
  };

  return `Page URL: ${current.url}
Current meta title: ${current.title}
Current meta description: ${current.description}
Current H1: ${current.h1}
Page word count: ${current.wordCount}
Subheadings (H2s): ${current.h2s}

Generate an improved meta title (50-60 chars), meta description (140-160 chars), and H1 for this page.`;
}
