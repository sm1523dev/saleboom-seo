/**
 * Pre-migration bootstrap — runs before `next dev` and `next start`.
 *
 * Two responsibilities:
 *
 * 1. Auto-register: any .sql file in drizzle/ that is NOT in _journal.json is
 *    added to the journal automatically. This means a developer can drop a raw
 *    SQL migration file into drizzle/ and it will be picked up on the next
 *    startup without manually editing _journal.json.
 *
 * 2. Migrate: runs drizzle-orm's migrator against the live database so every
 *    unappied migration is executed before the application handles requests.
 *
 * Works everywhere:
 *   - local dev   — env vars loaded from .env via --env-file-if-exists
 *   - Pi / VMs    — .env file optional; env vars can come from the shell
 *   - Azure       — env vars injected by App Service / Container Apps settings;
 *                   no .env file needed on the filesystem
 *
 * NOTE: Snapshot files (drizzle/meta/*.json other than _journal.json) are NOT
 * created for hand-written migrations. That is fine — the migrator only needs
 * the .sql file and a journal entry. If you later run `drizzle-kit generate`,
 * regenerate from the current schema.ts so its baseline is consistent.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { fileURLToPath } from "url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DRIZZLE_DIR = join(ROOT, "drizzle");
const JOURNAL_PATH = join(DRIZZLE_DIR, "meta", "_journal.json");
const JOURNAL_VERSION = "7";

// ── 1. Auto-register missing migrations ─────────────────────────────────────

const journal = JSON.parse(readFileSync(JOURNAL_PATH, "utf8"));
const registeredTags = new Set(journal.entries.map((e) => e.tag));

const sqlFiles = readdirSync(DRIZZLE_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

let journalDirty = false;
for (const file of sqlFiles) {
  const tag = basename(file, ".sql");
  if (registeredTags.has(tag)) continue;

  const when = Math.floor(statSync(join(DRIZZLE_DIR, file)).mtimeMs);
  journal.entries.push({
    idx: journal.entries.length,
    version: JOURNAL_VERSION,
    when,
    tag,
    breakpoints: true,
  });
  registeredTags.add(tag);
  journalDirty = true;
  console.log(`[premigrate] registered  ${tag}`);
}

if (journalDirty) {
  writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + "\n");
}

// ── 2. Run pending migrations ────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("[premigrate] ERROR: DATABASE_URL is not set");
  process.exit(1);
}

const { default: postgres } = await import("postgres");
const { drizzle } = await import("drizzle-orm/postgres-js");
const { migrate } = await import("drizzle-orm/postgres-js/migrator");

const useSSL =
  connectionString.includes("sslmode=require") ||
  connectionString.includes(".postgres.database.azure.com");
const client = postgres(connectionString, { max: 1, onnotice: () => {}, ...(useSSL && { ssl: "require" }) });
const db = drizzle(client);

await migrate(db, { migrationsFolder: DRIZZLE_DIR });
console.log("[premigrate] migrations up to date.");

// ── 3. Sync infra_providers to env-var overrides ─────────────────────────────
//
// Migration 0006 seeds dev-environment defaults (bullmq, local, mock, nim).
// On Azure/production the env vars (QUEUE_PROVIDER, STORAGE_PROVIDER, etc.)
// are set to the correct values. This step updates any row that still holds
// the dev default to the env-var value — but ONLY if the row has not been
// customised by a user (i.e. the current DB value IS the dev seed default).
// This preserves user changes made via the UI.

const DEV_SEEDS = {
  ai:            "nim",
  crawl:         "firecrawl",
  queue:         "bullmq",
  storage:       "local",
  notifications: "mock",
};

const ENV_OVERRIDES = {
  ai:            process.env.AI_PROVIDER,
  crawl:         process.env.CRAWL_PROVIDER,
  queue:         process.env.QUEUE_PROVIDER,
  storage:       process.env.STORAGE_PROVIDER,
  notifications: process.env.NOTIFICATION_PROVIDER,
};

for (const [type, envValue] of Object.entries(ENV_OVERRIDES)) {
  if (!envValue || envValue === DEV_SEEDS[type]) continue;
  const result = await client`
    UPDATE infra_providers
    SET name = ${envValue}, updated_at = NOW()
    WHERE type = ${type} AND name = ${DEV_SEEDS[type]}
  `;
  if (result.count > 0) {
    console.log(`[premigrate] provider ${type}: ${DEV_SEEDS[type]} → ${envValue}`);
  }
}

// ── 4. Seed AEO providers ────────────────────────────────────────────────────
//
// 6 NIM models across 3 architecture families — all routed via a single NIM API key.
// Upserts on display_name so re-runs are safe (rename = delete+insert via DEPRECATED list).
// This runs on every container start so workers/index.ts seedGlobalProviders() is not needed.
// Azure Functions run all 18 queries (6 providers × 3 prompts) concurrently with a per-query
// 45s abort signal — scores are always written even when NIM is slow.

const NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1";

const GLOBAL_PROVIDERS = [
  { displayName: "GPT-OSS 20B (NIM)", model: "openai/gpt-oss-20b" },
  { displayName: "Kimi K2.6 (NIM)",   model: "moonshotai/kimi-k2.6" },
  { displayName: "GLM 5.2 (NIM)",     model: "z-ai/glm-5.2" },
];

// Remove stale display names one-by-one (avoids ANY($1) array binding issues)
const DEPRECATED_AEO_NAMES = [
  "NVIDIA NIM",
  "Qwen 3 32B (via Groq)", "Qwen 3.6 27B (via Groq)",
  "GPT-OSS 120B (via Groq)", "GPT-OSS 20B (via Groq)",
  "GPT-OSS 120B (Groq)", "GPT-OSS 20B (Groq)",
  "Gemini 2.0 Flash (Google)", "Gemini 1.5 Flash (Google)",
  "Kimi K2.6 (NVIDIA NIM)", "GLM 5.2 (NVIDIA NIM)",
    // Groq placeholders added in error — reverting back to NIM
  "Llama 3.3 70B (Groq)", "Llama 3.1 70B (Groq)",
  "Qwen QwQ 32B (Groq)", "Mixtral 8x7B (Groq)",
  // Large NIM models dropped — GPT-OSS 20B/Kimi/GLM are faster
  "GPT-OSS 120B (NIM)", "Qwen 3.5 122B (NIM)", "Qwen 3 Next 80B (NIM)",
];

for (const name of DEPRECATED_AEO_NAMES) {
  await client`DELETE FROM aeo_providers WHERE display_name = ${name}`;
}

for (const p of GLOBAL_PROVIDERS) {
  await client`
    INSERT INTO aeo_providers
      (display_name, provider_type, endpoint_url, api_key_env_var, model, enabled)
    VALUES
      (${p.displayName}, 'openai-compat', ${NIM_ENDPOINT}, 'NVIDIA_NIM_API_KEY', ${p.model}, true)
    ON CONFLICT (display_name) DO UPDATE SET
      model          = EXCLUDED.model,
      endpoint_url   = EXCLUDED.endpoint_url,
      api_key_env_var = EXCLUDED.api_key_env_var,
      enabled        = true
  `;
}
console.log("[premigrate] AEO providers synced (3 NIM models)");

await client.end();
