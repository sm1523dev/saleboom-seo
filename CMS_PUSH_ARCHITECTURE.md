# CMS Push — Deployment Types, Architecture, and Roadmap

*Decision log covering the full discussion on how businesses deploy websites and how SaleBoom SEO supports auto-fixing SEO issues across each type.*

---

## The 5 Ways Businesses Deploy Websites

Broadly, businesses deploy websites in 5 ways. Each has a very different path to SEO push.

| # | Type | Examples | Push path |
|---|---|---|---|
| 1 | Traditional CMS | WordPress, Drupal, Joomla | REST API, writeable meta fields |
| 2 | SaaS Website Builders | Wix, Squarespace, Jimdo | Closed platforms, varies by provider |
| 3 | E-commerce Platforms | Shopify, BigCommerce, Magento | REST/GraphQL APIs |
| 4 | Headless CMS + Custom Frontend | Contentful, Sanity, Strapi + Next.js/Gatsby | Management APIs, field-based content model |
| 5 | Fully Custom-Built | Custom Next.js, React, Django, Laravel, Hugo, Jekyll | Source code — no push API |

### Current Coverage (as of 2026-07-16)

We support **3 of 5 categories**, with 1 adapter each:

- **WordPress** (Traditional CMS) — REST API + SEO plugin detection (Yoast, Rank Math, AIOSEO)
- **Shopify** (E-commerce) — GraphQL Admin API
- **Webflow** (Website Builders) — Webflow REST API

Missing entirely: Contentful, Sanity, Strapi (Headless CMS); GitHub/GitLab PR flow (Custom-built); Wix, BigCommerce (additional providers in covered categories).

---

## Category 4: Headless CMS

### Why it works well

Headless CMS push is **cleaner and more reliable than WordPress**:
- No plugin detection needed (no Yoast vs Rank Math vs AIOSEO ambiguity)
- No server-side caching between write and what the frontend renders
- APIs are purpose-built for programmatic content management
- Publish/draft workflow is explicit
- The pattern is identical to WordPress: resolve URL → find entry → write field → verify live

### The One Real Difference: No Standard Field Naming

Every headless CMS space has a different content model. One site calls it `seoTitle`, another `metaTitle`, another `openGraphTitle`. Unlike WordPress where we detect Yoast by checking available meta keys on the REST endpoint, headless CMS field names are entirely user-defined.

**This is solvable** — asking the user to type field names is not viable (a small business owner didn't build the site and doesn't know what a "content type field" is). But the field naming problem can be solved programmatically:

### Solution: Two-Stage Schema Probe + Content Matching

**Stage 1 — Schema heuristics:** Fetch the content type schema from the CMS API. Rank all text/string fields by name similarity to known SEO patterns:
- Title candidates (ranked): `seoTitle` → `metaTitle` → `openGraphTitle` → `pageTitle` → `title`
- Description candidates: `seoDescription` → `metaDescription` → `openGraphDescription` → `description`
- Slug candidates: `slug` → `handle` → `urlPath` → `path`

**Stage 2 — Content matching (self-validation):** We already have the crawled page title from the scan. Fetch a sample CMS entry and compare its string field values against the crawled values. The field whose value appears in (or contains) the crawled title is the SEO title field. This eliminates ambiguity without asking the user anything.

**Three outcomes at connection time:**
1. **High confidence match** → auto-map silently, push works immediately
2. **Ambiguous** (e.g. both `title` and `seoTitle` exist) → show candidates as a dropdown, user picks once
3. **No match** (new site, blank fields — nothing to match against) → write to most likely-named field; post-push verification (`Live ✓` / `Not live ⚠`) confirms correctness

The vast majority of real sites hit outcome 1 or 2. Outcome 3 is rare and self-corrects via verification.

### Platform-Specific Implementations

**Contentful** (highest priority — largest market share):
- Requires **Management API token** (different from the Delivery API token users already have — connection UI must explain this)
- Optimistic concurrency: every write must include `X-Contentful-Version` header — must fetch current version before each write, or WP returns 409 Conflict
- Locale-aware fields: field value shape is `{ "en-US": "value" }` — must read default locale at probe time
- **Publish step is critical**: after writing, entry is in draft. Must call a separate `/published` endpoint. If skipped, push shows "Applied" in SaleBoom but nothing changes on the live site

**Sanity** (cleanest API):
- GROQ query to find document by slug: `*[_type == "{type}" && {slugField}.current == "{slug}"][0]`
- PATCH mutation to update: `{ mutations: [{ patch: { id, set: { field: value } } }] }`
- No separate publish step for most configurations — mutations apply immediately
- Slug field is a reference type: `{ _type: "slug", current: "my-slug" }` — query must use `{slugField}.current`
- Popular `@sanity/seo-tools` plugin creates nested fields (`seo.title`, `seo.description`) — probe and push must handle dot-notation paths

**Strapi** (self-hosted complexity):
- Self-hosted: base URL varies per client — may not be reachable from SaleBoom's server
- Strapi v4 wraps all write payloads in a `data` key
- Draft/publish mode (if enabled): must also call `/actions/publish` after write
- Phase 1: Strapi v4 only; v3 surfaces a clear version error

### Plane Issues
- `#85` — Foundation: schema probe, field auto-detection, connection flow
- `#86` — Contentful adapter
- `#87` — Sanity adapter
- `#88` — Strapi adapter

---

## Category 5: Fully Custom-Built Sites

### The Problem

Custom-built websites store SEO meta in **source code files**. There is no push API — changes require a code edit and redeploy. Options:

1. **Code snippet** — generate code for the user to paste manually. Zero dependency. Client can cancel after copying.
2. **GitHub PR flow** — connect to the repo, make the change on a branch, open a PR. Client must return to SaleBoom for each fix.

### Why GitHub PR Flow, Not Code Snippets

The PR approach is strategically stronger:
- Creates a **service dependency** — clients must return to SaleBoom rather than copy-paste and cancel
- SaleBoom appears in **git history on every merge** — visible proof of value in the client's codebase
- PR description includes the SEO impact explanation — **educates and upsells**
- Forces the review workflow — developer sees the before/after and understands what changed

### Technical Architecture

**GitHub OAuth** → user selects their repo → **framework detection** (from repo file structure) → for each fix: create branch → **framework-specific file modifier** (AST-based) → commit → open PR → poll for merge → **trigger live verification** after deployment.

### Framework Detection

Detected by probing key files in the repo at connection time:

| Framework | Detection signal |
|---|---|
| Next.js App Router | `next.config.*` + `app/` directory |
| Next.js Pages Router | `next.config.*` + `pages/` directory |
| Hugo | `config.toml` or `config.yaml` at root + `layouts/` |
| Jekyll | `_config.yml` |
| Gatsby | `gatsby-config.js` |
| React Helmet | `package.json` with `react-helmet` dependency |

### File Modification: Why AST, Not String Replace

The hard part isn't creating the PR — GitHub API is straightforward. The hard part is **finding and modifying the right node in the right file** without breaking anything. String replacement is too brittle. The correct approach is AST (Abstract Syntax Tree) parsing:

- Parse the file with TypeScript Compiler API or `@babel/parser`
- Find the specific node (metadata export, Head component, front matter block)
- Update only that node using `magic-string` (source-preserving — preserves whitespace, comments, formatting)
- Re-parse to validate syntactical correctness before committing

**Safety rule:** if parsing fails for any reason, abort entirely — never commit a partially-modified file.

### Phase 1 Targets (Next.js + Hugo/Jekyll)

**Next.js App Router** — metadata export:
```tsx
// app/about/page.tsx
export const metadata: Metadata = {
  title: "Current Title",  // ← update this
  description: "Current Description",  // ← and this
}
```

**Next.js Pages Router** — Head component:
```tsx
<Head>
  <title>Current Title</title>
  <meta name="description" content="Current Description" />
</Head>
```

**Out of scope in Phase 1:** `generateMetadata()` functions (title is computed dynamically — cannot modify safely) and template literals in metadata (e.g. `` title: `${siteName} - About` ``). Both classified as Major Fix with explanation.

**Hugo/Jekyll front matter** — safest modification target (pure structured data, not code):
```yaml
---
title: "Current Title"
description: "Current Description"
---
```
Front matter is YAML, TOML, or JSON. Parse, update the key, re-serialize, reconstruct. Never touch the body below the front matter delimiter.

### Phase 2 Targets

- React Helmet / react-helmet-async (JSX AST approach, same as Pages Router Head)
- Gatsby Head API (same as App Router metadata)
- Django templates (regex-based block update — requires user to specify template file path once)
- Laravel Blade (regex-based `@section` directive update — same limitation)

**Django/Laravel limitation:** URL-to-template-file mapping cannot be automated without running the application. These are the only cases where some user input is unavoidable — user specifies the template file path once per page during setup.

### PR Creation Details

**Branch naming:** `saleboom/seo-{fieldType}-{pageSlug}-{YYYYMMDD}` — the `saleboom/` namespace groups all SaleBoom branches visually and allows easy filtering in GitHub.

**Commit message:** `seo: update {fieldLabel} on /{pageSlug}` — conventional commits format.

**PR description includes:** field label, page URL, before value, after value, SEO issue title and severity, link back to SaleBoom scan results. Serves as documentation and a soft upsell.

**Multi-fix batching:** multiple fixes for the same page are batched into a single branch and PR — reduces noise in the developer's PR queue.

**Status flow:** `Pending` → `PR Open` → `Applied` (after merge + deployment delay) → `Verified`

**Rollback:** close the PR if still open; open a revert PR if already merged.

### Plane Issues
- `#89` — GitHub OAuth integration + framework detection
- `#90` — Next.js App Router + Pages Router modifier (Phase 1)
- `#91` — Hugo + Jekyll front matter modifier (Phase 1)
- `#92` — PR creation engine (shared layer)
- `#93` — React Helmet, Gatsby, Django, Laravel (Phase 2)

---

## The 100% Foolproof Classification Problem

### Problem

Previously, "Quick Fix" meant "this issue type is theoretically auto-fixable." That caused false positives — fixes showed "Applied" but nothing changed on the live site (homepage empty slug bug, meta_description with no SEO plugin, stale plugin cache, etc.).

The correct definition: **Quick Fix = we have already proven, for this specific website, that we can write this field AND verify the result.**

### Solution: Capability Probe at Connection Time

When a CMS is connected, before saving, run a capability probe:
1. Can we authenticate?
2. Can we write `meta_title`?
3. Can we write `meta_description`?
4. Can we write `h1`?
5. Can we verify the result? (fetch live page, extract field from HTML)

Store result as a **capability profile** on `cms_connections.capabilities`:
```json
{
  "meta_title": true,
  "meta_description": false,
  "h1": true,
  "probeAt": "2026-07-16T..."
}
```

At scan time, `classifyFix()` uses the capability profile — not just the issue type. Nothing gets labelled Quick Fix unless we have already proven we can do it AND verify it for that exact site.

### WordPress-Specific Capability

WordPress has no native `meta description` field — it was never part of core. Without a SEO plugin (Yoast, Rank Math, or AIOSEO), there is genuinely no field to write to. The capability probe detects which plugin is installed and sets `meta_description: false` when none is found. This is a WordPress architectural limitation, not a SaleBoom limitation.

### The Trade-off: False Negatives vs False Positives

- **False positive** (shows Quick Fix, silently fails) → destroys client trust
- **False negative** (shows Major Fix, but technically could be fixed) → missed opportunity, acceptable

The capability probe eliminates false positives entirely. False negatives are handled by a **Re-probe button** on CMS Settings — if a client installs Yoast after connecting, they click Re-probe, capabilities update, and issues are reclassified immediately.

### UX Flow

**No CMS connected:** "Connect CMS to apply fixes" button (direct link to CMS settings, no dialog)

**CMS connected:** classification is done at scan time using stored capabilities. "Apply X Quick Fixes" shows the accurate count — no surprises when the user clicks apply.

**CMS connects after scan:** probe runs in the background, immediately re-classifies the latest scan's issues. User returns to results page and sees the accurate count.

---

## Post-Push Verification

Pushes that show "Applied" in the DB but don't change the live site were a real problem. After every push or rollback, the system now fetches the live page and checks whether the change actually appears.

### Root-Cause Tracking

Five specific failure codes stored in `change_snapshots.verify_error`:

| Code | Meaning |
|---|---|
| `cached_old_value` | Live page still shows old value — WordPress cache hasn't cleared |
| `value_mismatch` | Field found but doesn't match — plugin conflict or template override |
| `field_not_found` | `<title>` / `<meta description>` / `<h1>` not found in HTML |
| `fetch_timeout` | Site didn't respond within 8 seconds |
| `fetch_failed` | HTTP error from the server |

The Change History page shows a **"Verify" button** on each applied/rolled-back row. Clicking fetches the live page and shows `Live ✓` (green) or `Not live ⚠` (red) with the specific failure reason and the actual live value found.

---

## Residual Gaps (Accepted)

No system handling this problem space can be 100% foolproof. The irreducible gaps:

**Write-side:**
- Custom SEO plugins not in our detection set
- Frontend code that overrides the CMS value at render time (e.g. Next.js `generateMetadata` appends brand name programmatically)
- Squarespace and some other SaaS builders don't expose SEO fields via API at all
- Nested CMS field structures we haven't detected

**Verify-side:**
- CDN/Cloudflare cache that takes hours to clear — verification fetch sees old content
- JavaScript-rendered meta (SPA with client-side Helmet) — HTML fetch gets the shell, not the rendered title
- Geolocation-served content — different title per country

**Realistic ceiling: ~85–90% of real-world sites handled automatically.** The remaining 10–15% surface as verification failures with specific root causes, which become managed service interactions rather than silent failures. The gap is what separates a tool from a service.

---

## Priority Order

1. **Now done:** WordPress, Shopify, Webflow adapters + capability probe + verification
2. **Next:** Headless CMS — Contentful (#86) + Sanity (#87) after foundation (#85)
3. **After:** GitHub PR flow — OAuth (#89) + Next.js modifier (#90) + PR engine (#92)
4. **Later:** Strapi (#88), Hugo/Jekyll (#91), Wix, BigCommerce
5. **Phase 2:** React Helmet, Django, Laravel (#93)

Hugo/Jekyll (Phase 1 of custom sites) is prioritised above Strapi and other adapters because front matter modification is significantly safer and simpler than code AST parsing — low risk, high confidence.
