# Week 1 Plan — Foundation & Infrastructure
**Module deadline: 2026-07-02 | Status: 1/8 done (#23 Next.js setup)**

---

## Sprint Order

| # | Issue | Priority | Start | State |
|---|-------|----------|-------|-------|
| 1 | [#34] PostgreSQL schema (users, websites, scans, issues, cms_connections, change_snapshots, aeo_mentions + pgvector) | urgent | 2026-06-26 | Todo |
| 2 | [#38] Azure Queue Storage + Azure Functions async scan worker pipeline | urgent | 2026-06-27 | Todo |
| 3 | [#41] Auth.js (NextAuth v5) + Microsoft Entra ID + proxy.ts middleware | urgent | 2026-06-27 | Todo |
| 4 | [#44] Firecrawl SDK wrapper (retry, timeout, typed response) — self-hosted at localhost:3002 | high | 2026-06-28 | Todo |
| 5 | [#46] Azure OpenAI client via Vercel AI SDK + generateObject + Zod schemas | high | 2026-06-29 | Todo |
| 6 | [#50] GitHub Actions CI/CD → Azure App Service on push to main | high | 2026-06-30 | Todo |
| 7 | [#52] Docker Compose: Postgres + Azurite + self-hosted Firecrawl for local dev | medium | 2026-07-01 | Todo |

---

## #34 · PostgreSQL Schema

**Packages:** `drizzle-orm`, `postgres`, `drizzle-kit` (dev)  
**Enable:** `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector)

**New files:**
- `lib/db/index.ts` — Drizzle client singleton (`DATABASE_URL`)
- `lib/db/schema.ts` — all table definitions
- `lib/db/migrate.ts` — migration runner
- `drizzle.config.ts`

**Tables** (all have `id uuid`, `created_at`, `updated_at`, soft-delete `deleted_at`):
- `users` — id, email, name, tenant_id, avatar_url
- `websites` — id, user_id FK, url, name, verified_at
- `scans` — id, website_id FK, status enum, raw_crawl jsonb, started_at, completed_at
- `issues` — id, scan_id FK, type, severity enum, title, description, fix_type (quick|major), resolved_at
- `cms_connections` — id, website_id FK, cms_type enum, credentials_ref, connected_at
- `change_snapshots` — id, issue_id FK, cms_connection_id FK, before_state jsonb, after_state jsonb, status enum, applied_at
- `aeo_mentions` — id, website_id FK, platform enum, query text, position int, snippet text, sentiment enum, mention_embedding vector(1536), scanned_at

**Env vars:** `DATABASE_URL`

---

## #38 · Azure Queue Storage + Azure Functions

**Packages (Next.js app):** `@azure/storage-queue`

**New directory: `azure-functions/`** (separate Node.js project, Azure Functions v4 model)
```
azure-functions/
  host.json
  package.json
  tsconfig.json
  src/functions/
    scan-worker.ts     ← queue trigger
    rescan-timer.ts    ← timer trigger (weekly)
  src/lib/
    db.ts              ← shared Drizzle client
```

**New files (Next.js app):**
- `lib/queue/client.ts` — `QueueServiceClient` singleton
- `lib/queue/enqueue-scan.ts` — `enqueueScan(websiteId, scanId)`
- `lib/queue/types.ts` — Zod schema for queue message

**Dead-letter queue:** `scan-jobs-poison`, `maxDequeueCount: 5`  
**Env vars:** `AZURE_STORAGE_CONNECTION_STRING`, `AZURE_STORAGE_ACCOUNT_NAME`  
**Deploy:** floci-az (do not install — user provides)

---

## #41 · Auth.js (NextAuth v5) + Entra ID

**Packages:** `next-auth@5`, `@auth/core`

**New files:**
- `lib/auth.ts` — NextAuth config, `MicrosoftEntraID` provider, JWT session, tenant callbacks
- `lib/auth-utils.ts` — `getServerSession()` wrapper (throws if unauthed)
- `app/api/auth/[...nextauth]/route.ts` — re-exports `{ GET, POST }`

**Modified:**
- `proxy.ts` — protect `(dashboard)` routes, skip `(public)` and `(auth)`
- `app/(auth)/sign-in/_components/sign-in-card.tsx` — wire "Sign in with Microsoft" CTA

**Env vars:** `AUTH_SECRET`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`

---

## #44 · Firecrawl SDK Wrapper

**Packages:** `@mendable/firecrawl-js`, `zod`

**New files:**
- `lib/crawl/types.ts` — Zod schema for `CrawlResult`
- `lib/crawl/firecrawl-client.ts` — typed wrapper, exponential backoff (max 3, base 1s), timeout, typed errors

**Self-hosted:** Firecrawl Docker on port 3002  
**Env vars:** `FIRECRAWL_API_URL=http://localhost:3002`, `FIRECRAWL_API_KEY` (any string for self-hosted), `FIRECRAWL_TIMEOUT_MS`

---

## #46 · Azure OpenAI Client (Vercel AI SDK)

**Packages:** `ai`, `@ai-sdk/azure`, `zod` (already installed)

**New files:**
- `lib/ai/client.ts` — singleton `createAzure()` client
- `lib/ai/generate.ts` — `generateStructured<T>(schema, prompt, opts): Promise<T>`
- `lib/ai/schemas/index.ts` — barrel export
- `lib/ai/schemas/seo-suggestions.ts` — meta title / description / H1 schema
- `lib/ai/schemas/aeo-mentions.ts` — mention extraction schema

**Env vars:** `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION`

---

## #50 · GitHub Actions CI/CD

**New files:**
- `.github/workflows/ci.yml` — lint + tsc + build on PR/push
- `.github/workflows/deploy.yml` — deploy to Azure App Service on push to main (OIDC, no plaintext secrets)

**Env vars (GitHub secrets):** `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`

---

## #52 · Docker Compose Local Dev

**New files:**
- `docker-compose.yml` — postgres (pgvector/pgvector:pg16), azurite, firecrawl (mendable/firecrawl-dev)
- `.env.local.example` — complete env var template
- `scripts/dev-setup.sh` — `docker compose up -d && npm run db:migrate`
- `package.json` additions: `db:migrate` (`drizzle-kit push`), `db:studio` (`drizzle-kit studio`)

---

## Quality Gates (every issue)

1. `npx tsc --noEmit` — zero errors
2. `npm run lint` — zero warnings
3. `npm run dev` — no console errors
4. Feature smoke test (described per issue above)
5. Plane issue → **Done**
