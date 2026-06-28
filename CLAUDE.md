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
- Firecrawl is self-hosted locally at `localhost:3002` — use `FIRECRAWL_API_URL` env var
- ORM: Drizzle ORM (not Prisma)
- Auth: NextAuth v5 (Auth.js) with Microsoft Entra ID only
- Azure infra: Azure Queue Storage + Azure Functions (Node.js v4 model)
- No Co-authored-by in commits (see AGENTS.md §7.3)
