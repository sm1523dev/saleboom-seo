import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  boolean,
  real,
  date,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";


const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const scanStatusEnum = pgEnum("scan_status", [
  "pending",
  "running",
  "completed",
  "failed",
]);

export const severityEnum = pgEnum("severity", [
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);

export const fixTypeEnum = pgEnum("fix_type", ["quick", "major"]);

export const cmsTypeEnum = pgEnum("cms_type", [
  "wordpress",
  "shopify",
  "webflow",
  "contentful",
  "custom",
]);

export const changeStatusEnum = pgEnum("change_status", [
  "pending",
  "applied",
  "failed",
  "reverted",
  "rolled_back",
]);

export const aeoSentimentEnum = pgEnum("aeo_sentiment", [
  "positive",
  "neutral",
  "negative",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  tenantId: varchar("tenant_id", { length: 255 }),
  avatarUrl: text("avatar_url"),
  passwordHash: varchar("password_hash", { length: 255 }),
  ...timestamps,
});

export const websites = pgTable(
  "websites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("websites_user_id_idx").on(t.userId)],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    status: scanStatusEnum("status").notNull().default("pending"),
    rawCrawl: jsonb("raw_crawl"),
    pagesScanned: integer("pages_scanned"),
    totalPages: integer("total_pages"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("scans_website_id_idx").on(t.websiteId)],
);

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    pageUrl: text("page_url"),
    type: varchar("type", { length: 100 }).notNull(),
    severity: severityEnum("severity").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    fixType: fixTypeEnum("fix_type"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    ignoredAt: timestamp("ignored_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("issues_scan_id_idx").on(t.scanId),
    index("issues_severity_idx").on(t.severity),
  ],
);

export const cmsConnections = pgTable(
  "cms_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    cmsType: cmsTypeEnum("cms_type").notNull(),
    credentialsRef: varchar("credentials_ref", { length: 500 }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("cms_connections_website_id_idx").on(t.websiteId),
    uniqueIndex("cms_connections_website_cms_type_idx").on(t.websiteId, t.cmsType),
  ],
);

export const changeSnapshots = pgTable(
  "change_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Which page and field this snapshot covers
    pageUrl: text("page_url").notNull(),
    fieldChanged: text("field_changed").notNull(), // "meta_title" | "meta_description" | "h1"
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    status: changeStatusEnum("status").notNull().default("pending"),
    // Set when the change is pushed to CMS
    cmsConnectionId: uuid("cms_connection_id").references(
      () => cmsConnections.id,
      { onDelete: "set null" },
    ),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    // Set when the change is rolled back
    rolledBackAt: timestamp("rolled_back_at", { withTimezone: true }),
    // Source: either from an AI suggestion or a manual issue fix
    suggestionId: uuid("suggestion_id").references(() => aiSuggestions.id, {
      onDelete: "set null",
    }),
    issueId: uuid("issue_id").references(() => issues.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("change_snapshots_page_url_idx").on(t.pageUrl),
    index("change_snapshots_status_idx").on(t.status),
    index("change_snapshots_cms_id_idx").on(t.cmsConnectionId),
    index("change_snapshots_suggestion_id_idx").on(t.suggestionId),
    index("change_snapshots_issue_id_idx").on(t.issueId),
  ],
);

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "dismissed",
  "applied",
]);

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    // denormalised for cross-scan queries (dismissed pages lookup in worker)
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),
    // Current values (before)
    currentMetaTitle: text("current_meta_title"),
    currentMetaDescription: text("current_meta_description"),
    currentH1: text("current_h1"),
    // AI-suggested values (after)
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    h1: text("h1"),
    model: varchar("model", { length: 100 }),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    latencyMs: integer("latency_ms"),
    status: suggestionStatusEnum("status").default("pending").notNull(),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("ai_suggestions_scan_id_idx").on(t.scanId),
    index("ai_suggestions_website_id_idx").on(t.websiteId),
    index("ai_suggestions_page_url_idx").on(t.pageUrl),
  ],
);

// ─── AEO: Three-Signal Architecture ─────────────────────────────────────────

// Provider type stored as varchar (not enum) — extensible without migrations
// Platform-managed global providers — no per-user configuration
export const aeoProviders = pgTable(
  "aeo_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 100 }).notNull().unique(),
    // "openai-compat" | "anthropic" | "google" | "perplexity"
    providerType: varchar("provider_type", { length: 30 }).notNull(),
    endpointUrl: text("endpoint_url"),
    // "env:GROQ_API_KEY" — resolved at query time from env vars
    apiKeyEnvVar: varchar("api_key_env_var", { length: 100 }),
    model: varchar("model", { length: 100 }).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    ...timestamps,
  },
  (t) => [index("aeo_providers_enabled_idx").on(t.enabled)],
);

export const aeoQueries = pgTable(
  "aeo_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    promptText: text("prompt_text").notNull(),
    categoryTag: varchar("category_tag", { length: 50 }),
    active: boolean("active").default(true).notNull(),
    ...timestamps,
  },
  (t) => [index("aeo_queries_website_id_idx").on(t.websiteId)],
);

// Signal 1 — brand mention results from prompt sampling
export const aeoMentions = pgTable(
  "aeo_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aeoProviders.id, { onDelete: "cascade" }),
    queryId: uuid("query_id")
      .notNull()
      .references(() => aeoQueries.id, { onDelete: "cascade" }),
    scanDate: date("scan_date").notNull(),
    brandMentioned: boolean("brand_mentioned").notNull(),
    // "strong" (top 20%) | "moderate" (20-50%) | "weak" (50%+) | "absent"
    positionBucket: varchar("position_bucket", { length: 20 }),
    sentiment: aeoSentimentEnum("sentiment"),
    surroundingText: text("surrounding_text"),
    ...timestamps,
  },
  (t) => [
    index("aeo_mentions_website_id_idx").on(t.websiteId),
    index("aeo_mentions_provider_id_idx").on(t.providerId),
    uniqueIndex("aeo_mentions_provider_query_date_idx").on(
      t.providerId,
      t.queryId,
      t.scanDate,
    ),
  ],
);

// Signal 3 — citations extracted from RAG platform responses (free, piggybacks on Signal 1)
export const aeoCitations = pgTable(
  "aeo_citations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => aeoProviders.id, { onDelete: "cascade" }),
    queryId: uuid("query_id")
      .notNull()
      .references(() => aeoQueries.id, { onDelete: "cascade" }),
    scanDate: date("scan_date").notNull(),
    citedUrl: text("cited_url").notNull(),
    isOwnDomain: boolean("is_own_domain").notNull(),
    ...timestamps,
  },
  (t) => [
    index("aeo_citations_website_id_idx").on(t.websiteId),
    index("aeo_citations_provider_id_idx").on(t.providerId),
    index("aeo_citations_is_own_domain_idx").on(t.isOwnDomain),
  ],
);

// Signal 2 — real visits originating from AI platforms (tracked via JS snippet)
export const aiReferrals = pgTable(
  "ai_referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    visitedAt: timestamp("visited_at", { withTimezone: true }).notNull(),
    referrerPlatform: varchar("referrer_platform", { length: 60 }).notNull(),
    landingPath: text("landing_path").notNull(),
    sessionId: uuid("session_id").notNull(),
    ...timestamps,
  },
  (t) => [
    index("ai_referrals_website_id_idx").on(t.websiteId),
    index("ai_referrals_visited_at_idx").on(t.visitedAt),
    // deduplicate: one row per session
    uniqueIndex("ai_referrals_session_idx").on(t.websiteId, t.sessionId),
  ],
);

// DVS™ composite score — updated after every SEO or AEO scan
export const dvsScores = pgTable(
  "dvs_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull(),
    seoScore: real("seo_score").notNull(),
    aeoScore: real("aeo_score").notNull(),
    compositeScore: real("composite_score").notNull(),
    ...timestamps,
  },
  (t) => [
    index("dvs_scores_website_id_idx").on(t.websiteId),
    index("dvs_scores_scored_at_idx").on(t.scoredAt),
  ],
);

// Business metrics time-series events
export const metricsEvents = pgTable(
  "metrics_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    event: text("event").notNull(),
    value: real("value"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("metrics_events_event_idx").on(t.event),
    index("metrics_events_created_at_idx").on(t.createdAt),
  ],
);

// Composite AEO score snapshot — one row per website per run
export const aeoScores = pgTable(
  "aeo_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull(),
    signal1Rate: real("signal1_rate").notNull(),
    signal2Index: real("signal2_index").notNull(),
    signal3Rate: real("signal3_rate").notNull(),
    compositeScore: real("composite_score").notNull(),
    ...timestamps,
  },
  (t) => [
    index("aeo_scores_website_id_idx").on(t.websiteId),
    index("aeo_scores_scored_at_idx").on(t.scoredAt),
  ],
);
