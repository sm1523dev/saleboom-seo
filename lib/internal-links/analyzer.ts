export type PageData = {
  url: string;
  title: string | null;
  h1: string | null;
  outboundLinks: string[];
};

export type LinkOpportunity = {
  sourceUrl: string;
  sourceTitle: string | null;
  targetUrl: string;
  targetTitle: string | null;
  score: number;
  sharedKeywords: string[];
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "do", "does", "did", "will", "would", "could", "should", "may", "might", "shall",
  "not", "no", "nor", "so", "yet", "both", "either", "neither", "each", "few", "more",
  "most", "other", "some", "such", "than", "then", "there", "these", "they", "this",
  "those", "through", "under", "until", "up", "very", "what", "which", "while", "who",
  "whom", "why", "how", "all", "any", "both", "each", "your", "our", "their", "its",
]);

function extractKeywords(text: string | null): Set<string> {
  if (!text) return new Set();
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
}

function overlapScore(a: Set<string>, b: Set<string>): { score: number; shared: string[] } {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };
  const shared = [...a].filter((w) => b.has(w));
  return { score: shared.length / Math.sqrt(a.size * b.size), shared };
}

export function findLinkOpportunities(pages: PageData[]): LinkOpportunity[] {
  const opportunities: LinkOpportunity[] = [];
  const pageKeywords = pages.map((p) => ({
    url: p.url,
    keywords: extractKeywords(`${p.title ?? ""} ${p.h1 ?? ""}`),
  }));

  for (let i = 0; i < pages.length; i++) {
    const src = pages[i];
    const srcKw = pageKeywords[i].keywords;
    const outboundSet = new Set(src.outboundLinks);
    const candidates: LinkOpportunity[] = [];

    for (let j = 0; j < pages.length; j++) {
      if (i === j || outboundSet.has(pages[j].url)) continue;
      const { score, shared } = overlapScore(srcKw, pageKeywords[j].keywords);
      if (score > 0.1 && shared.length >= 2) {
        candidates.push({
          sourceUrl: src.url,
          sourceTitle: src.title,
          targetUrl: pages[j].url,
          targetTitle: pages[j].title,
          score,
          sharedKeywords: shared.slice(0, 5),
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    opportunities.push(...candidates.slice(0, 5));
  }

  return opportunities.sort((a, b) => b.score - a.score);
}
