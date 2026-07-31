@AGENTS.md

## Tool Usage (Mandatory)

When working on any task in this project, always use available tools proactively:

- **Skills** — invoke relevant skills via the `Skill` tool before writing any code (design: `impeccable`, `taste-design`, `frontend-design`, `emil-design-eng`; GSAP: `gsap-react`, `gsap-scrolltrigger`; UI: `shadcn-ui`)
- **context7** — fetch latest docs for any library before using it (Next.js, Drizzle, Auth.js, Vercel AI SDK, Azure SDKs, etc.)
- **code-review-graph** — use `detect_changes`, `get_impact_radius`, `query_graph` for all code review and impact analysis
- **shadcn MCP** (`.mcp.json`) — use for component discovery and install commands
- **Plane API** — check and update issue state at session start and on completion

## Weekly Sprint Protocol

**At the start of every session on this project:**

1. Read the active week plan: `~/workspace/personal/sm1523dev/saleboom_seo/Week<N>_Plan.md`
2. Check Plane for current issue states:
   - Workspace: `saleboom-seo`
   - Project ID: `cf6cbe32-4c98-464b-be0b-5a97d04420b6`
   - Auth header: `x-api-key: plane_api_00c746a72a2341f3973d3e2d10c450c1`
   - Endpoint: `GET https://api.plane.so/api/v1/workspaces/saleboom-seo/projects/cf6cbe32-4c98-464b-be0b-5a97d04420b6/issues/?per_page=100`
3. Identify the next issue in the sprint order that is NOT Done
4. Move that issue to **In Progress** in Plane before starting work
5. On completion, move to **Done** in Plane, then proceed to the next

**Week 1 plan**: `Week1_Plan.md` | Module: Foundation & Infrastructure | Deadline: 2026-07-02
**Issue order**: #34 → #38 → #41 → #44 → #46 → #50 → #52

**Standing constraints (all sessions, all weeks):**
- `floci-az` is the Azure deployment/management tool — do not install it; user provides it
- Firecrawl is the **cloud service** (`https://api.firecrawl.dev`) — set `FIRECRAWL_API_KEY` only; do NOT set `FIRECRAWL_API_URL`
- ORM: Drizzle ORM (not Prisma)
- Auth: NextAuth v5 (Auth.js) with Microsoft Entra ID only
- Azure infra: Azure Queue Storage + Azure Functions (Node.js v4 model)
- No Co-authored-by in commits (see AGENTS.md §7.3)


## 💰 Spending Cap: $50 per Task Session

### Pricing (based on actual account data)
| Model              | Input      | Output     | Cache Read | Cache Write |
|--------------------|------------|------------|------------|-------------|
| Claude 4.6 Sonnet  | $3.00/1M   | $15.00/1M  | $0.30/1M   | $3.75/1M    |
| Claude 5 Sonnet    | $2.00/1M   | $10.00/1M  | $0.20/1M   | —           |
| Claude 4.5 Haiku   | $1.00/1M   | $4.76/1M   | $0.10/1M   | $1.25/1M    |

### ⚠️ Cache Cost Warning
Cache writes are the dominant cost driver in this account.
Assume every large file/context loaded costs ~$3.75 per 1M tokens written to cache.
Estimate cache write cost BEFORE loading large files or long contexts.

### Before Starting Any Task
1. Estimate total cost:
   - Output tokens dominate execution cost → budget ~$15/1M output tokens
   - Cache writes dominate context cost → budget ~$3.75/1M cache-write tokens
2. If estimated cost > $50: DO NOT proceed.
   Instead, present a scoped plan: what fits in $50 and what does not.
3. If estimated cost ≤ $50: Proceed, tracking spend after each major step.

### During Execution
- After each major step, estimate cumulative spend.
- At $45 spent (~90% of budget): STOP and generate HANDOVER.md immediately.
  (The remaining $5 covers the handover document itself.)

### Handover Document (auto-generate at $45)
Save as `HANDOVER.md`:

```
# Task Handover

## 📋 Original Request
[Exact user ask]

## 💰 Budget Used
Estimated: ~$XX of $50

## ✅ Completed Work
- [What was done]
- [Files created/modified with paths]

## 🔄 Remaining Work
1. [Next step]
2. [Following step]

## 🧠 Context & State
- Key decisions made:
- Current code/data state:
- Known issues or blockers:
- Important variables/configs:

## 💵 Estimated Cost to Complete
~$XX additional needed | Recommended model: [Haiku/Sonnet/etc.]

## ▶️ Resume Prompt
Paste this to continue in a new session:
> "Read HANDOVER.md and continue from step [N].
>  Context: [key state]. Files are at [paths]."
```

### Cost-Saving Tips
- Prefer **Claude 4.5 Haiku** for planning, search, and simple edits (3x cheaper output)
- Avoid reloading large files repeatedly (cache writes are expensive)
- Break large tasks into smaller sessions with explicit checkpoints
