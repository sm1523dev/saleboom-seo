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

const client = postgres(connectionString, { max: 1, onnotice: () => {} });
const db = drizzle(client);

await migrate(db, { migrationsFolder: DRIZZLE_DIR });
await client.end();
console.log("[premigrate] migrations up to date.");
