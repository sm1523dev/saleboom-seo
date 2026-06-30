import type { MentionResult, CitationResult } from "./types";

const POSITIVE_WORDS = [
  "recommend", "best", "top", "excellent", "great", "outstanding",
  "leading", "trusted", "popular", "preferred", "award", "highly rated",
];
const NEGATIVE_WORDS = [
  "avoid", "poor", "worst", "bad", "unreliable", "scam", "overpriced",
  "disappointing", "slow", "broken", "deprecated", "unsafe",
];

export function parseMention(text: string, brandName: string): MentionResult {
  const lowerText = text.toLowerCase();
  const lowerBrand = brandName.toLowerCase();
  const idx = lowerText.indexOf(lowerBrand);
  const brandMentioned = idx !== -1;

  if (!brandMentioned) {
    return { brandMentioned: false, positionBucket: "absent", sentiment: "neutral", surroundingText: null };
  }

  const positionRatio = idx / Math.max(lowerText.length, 1);
  let positionBucket: MentionResult["positionBucket"];
  if (positionRatio < 0.2) positionBucket = "strong";
  else if (positionRatio < 0.5) positionBucket = "moderate";
  else positionBucket = "weak";

  const window = lowerText.slice(Math.max(0, idx - 100), idx + brandName.length + 100);
  const positiveHits = POSITIVE_WORDS.filter((w) => window.includes(w)).length;
  const negativeHits = NEGATIVE_WORDS.filter((w) => window.includes(w)).length;
  let sentiment: MentionResult["sentiment"] = "neutral";
  if (positiveHits > negativeHits) sentiment = "positive";
  else if (negativeHits > positiveHits) sentiment = "negative";

  const surroundingText = text.slice(Math.max(0, idx - 75), idx + brandName.length + 75).trim();

  return { brandMentioned, positionBucket, sentiment, surroundingText };
}

const URL_PATTERN = /https?:\/\/[^\s\)\]\}"'<>]+/g;
const FOOTNOTE_PATTERN = /\[\d+\]:\s*(https?:\/\/[^\s]+)/g;

export function extractCitations(text: string, ownDomain: string): CitationResult {
  const urls = new Set<string>();

  for (const m of text.matchAll(URL_PATTERN)) urls.add(m[0].replace(/[.,;!?]+$/, ""));
  for (const m of text.matchAll(FOOTNOTE_PATTERN)) urls.add(m[1].replace(/[.,;!?]+$/, ""));

  return Array.from(urls).map((citedUrl) => {
    let isOwnDomain = false;
    try {
      const host = new URL(citedUrl).hostname.replace(/^www\./, "");
      const own = ownDomain.replace(/^www\./, "").replace(/^https?:\/\//, "");
      isOwnDomain = host === own || host.endsWith(`.${own}`);
    } catch {
      // invalid URL — skip
    }
    return { citedUrl, isOwnDomain };
  });
}
