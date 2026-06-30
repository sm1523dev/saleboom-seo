# SaleBoom SEO

AI-powered SEO + AEO (Answer Engine Optimization) platform for agencies and businesses who want to understand and improve their visibility — both in Google search and in AI tools like ChatGPT, Gemini, and Perplexity.

---

## What it does

### SEO Intelligence
- Crawls up to 100 pages of any website using Firecrawl
- Runs 50+ SEO checks: meta titles, descriptions, H1s, canonical tags, Open Graph, structured data, image alt tags, redirect chains, and more
- Scores each site 0–100 based on unique issue types (not per-page occurrence)
- Classifies every issue as **Quick Fix** (AI can suggest a fix) or **Major Fix** (needs human judgment)
- Generates AI-written meta title, description, and H1 suggestions for pages with critical/high issues — shows current vs suggested side by side with copy buttons

### AEO Intelligence (Answer Engine Optimization)
- Queries 4 AI models (via Groq — free) with brand-relevant prompts and detects whether your brand is mentioned
- Tracks mention rate per AI platform, sentiment, and position in the response
- Captures real AI referral traffic via a lightweight JS tracking snippet (Signal 2)
- Extracts cited source URLs from RAG-based platforms like Perplexity (Signal 3)
- Scores AEO 0–100: Signal 1 (mention rate) × 0.70 + Signal 2 (referral traffic) × 0.20 + Signal 3 (citations) × 0.10

### DVS™ (Digital Visibility Score)
- Composite score combining SEO (65%) and AEO (35%) into a single number
- Tracked over time with a 30-day trend chart
- Shown prominently on the per-website dashboard

### Issue & Suggestion Management
- Select and bulk-ignore issues or suggestions — ignored items are excluded from future scans
- Un-ignore at any time from the "Show ignored" toggle
- Apply suggestions to your CMS with one click — coming soon (WordPress, Shopify, Webflow)
- Scan history preserved — view any past scan's full results, issues, and suggestions

### Multi-website support
- Portfolio view when managing 2+ websites: all sites with SEO/AEO/DVS scores at a glance
- Single-website view redirects directly to that site's full dashboard

---

## Local setup

### Prerequisites

- Node.js 22+
- PostgreSQL 17
- Redis 7

**Or skip both and use Docker:**

```bash
npm run docker:up
```

### Steps

```bash
# 1. Clone and install
git clone https://github.com/SaleBoomSEO/SEO_Integration.git
cd SEO_Integration
npm install

# 2. Configure environment
cp .env.local.example .env.local
# Edit .env.local and fill in your API keys (see below)

# 3. Create the database (skip if using Docker)
createdb saleboom_seo

# 4. Run migrations
npm run db:push

# 5. Start
npm run dev:all
```

The app runs at `http://localhost:3000`. The queue dashboard runs at `http://localhost:4000/admin/queues`.

---

## API keys

| Key | Required | Where to get |
|-----|----------|--------------|
| `GROQ_API_KEY` | Yes | [console.groq.com](https://console.groq.com) — free tier |
| `FIRECRAWL_API_KEY` | Yes | [firecrawl.dev](https://firecrawl.dev) — free tier |
| `GOOGLE_AI_API_KEY` | Optional | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — free |

---

## npm scripts

| Command | What it does |
|---------|-------------|
| `npm run dev:all` | Start Next.js + worker together (recommended) |
| `npm run dev:nextjs` | Next.js only |
| `npm run dev:worker` | Worker only |
| `npm run docker:up` | Start Postgres + Redis in Docker |
| `npm run docker:down` | Stop Docker services |
| `npm run db:push` | Apply schema changes to database |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run lint` | Run ESLint |

---

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Drizzle ORM** · **PostgreSQL 17**
- **BullMQ** · **Redis** (job queue)
- **Groq** (AI — free tier) · **Firecrawl** (web crawling)
- **Tailwind CSS v4** · **shadcn/ui** · **motion.dev**
