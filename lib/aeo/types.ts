export type AeoProviderType = "openai-compat" | "anthropic" | "google" | "perplexity";

export type AeoProvider = {
  id: string;
  displayName: string;
  providerType: AeoProviderType;
  endpointUrl: string | null;
  apiKeyEnvVar: string | null;
  model: string;
};

export type QueryResult = {
  text: string;
  citations: string[];
};

export type MentionResult = {
  brandMentioned: boolean;
  positionBucket: "strong" | "moderate" | "weak" | "absent";
  sentiment: "positive" | "neutral" | "negative";
  surroundingText: string | null;
};

export type CitationResult = {
  citedUrl: string;
  isOwnDomain: boolean;
}[];
