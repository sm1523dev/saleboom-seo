import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  jsonb,
  integer,
  pgEnum,
  index,
  customType,
} from "drizzle-orm/pg-core";

const vector = customType<{ data: number[]; driverData: string }>({
  dataType(config: unknown) {
    const dim = (config as Record<string, unknown> | undefined)?.dimensions as
      | number
      | undefined;
    return dim ? `vector(${dim})` : "vector";
  },
  toDriver(val: number[]): string {
    return `[${val.join(",")}]`;
  },
  fromDriver(val: string): number[] {
    return val
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

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
]);

export const aeoSentimentEnum = pgEnum("aeo_sentiment", [
  "positive",
  "neutral",
  "negative",
]);

export const aeoPlatformEnum = pgEnum("aeo_platform", [
  "chatgpt",
  "perplexity",
  "gemini",
  "claude",
  "other",
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
    type: varchar("type", { length: 100 }).notNull(),
    severity: severityEnum("severity").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    description: text("description"),
    fixType: fixTypeEnum("fix_type"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
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
  (t) => [index("cms_connections_website_id_idx").on(t.websiteId)],
);

export const changeSnapshots = pgTable(
  "change_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    cmsConnectionId: uuid("cms_connection_id")
      .notNull()
      .references(() => cmsConnections.id, { onDelete: "cascade" }),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    status: changeStatusEnum("status").notNull().default("pending"),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("change_snapshots_issue_id_idx").on(t.issueId),
    index("change_snapshots_cms_id_idx").on(t.cmsConnectionId),
  ],
);

export const aiSuggestions = pgTable(
  "ai_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    pageUrl: text("page_url").notNull(),
    metaTitle: text("meta_title"),
    metaDescription: text("meta_description"),
    h1: text("h1"),
    model: varchar("model", { length: 100 }),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    latencyMs: integer("latency_ms"),
    ...timestamps,
  },
  (t) => [
    index("ai_suggestions_scan_id_idx").on(t.scanId),
    index("ai_suggestions_page_url_idx").on(t.pageUrl),
  ],
);

export const aeoMentions = pgTable(
  "aeo_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    platform: aeoPlatformEnum("platform").notNull(),
    query: text("query").notNull(),
    position: integer("position"),
    snippet: text("snippet"),
    sentiment: aeoSentimentEnum("sentiment"),
    mentionEmbedding: vector("mention_embedding", { dimensions: 1536 }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("aeo_mentions_website_id_idx").on(t.websiteId),
    index("aeo_mentions_platform_idx").on(t.platform),
  ],
);
