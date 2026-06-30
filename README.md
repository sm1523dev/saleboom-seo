# SaleBoom SEO

AI-powered SEO + AEO (Answer Engine Optimization) platform. Scans websites for SEO issues, tracks brand visibility across AI tools, and generates AI-written copy suggestions.

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
