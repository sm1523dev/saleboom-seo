<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# SaleBoom SEO — Agent Canonical Reference

**Read this file completely before writing a single line of code.**
This document is the source of truth for every AI tool, agent, or model (Claude Code, Cursor, Codex, Antigravity, OpenCode, or any other) working on this project.

---

## 1. Project Overview

SaleBoom SEO is an AI-powered **SEO + AEO (Answer Engine Optimization)** platform.
The product is a dark, intelligent, premium web app — think Perplexity, Linear, Vercel, Anthropic.

**Stack**:
- Next.js 16 (App Router, no Pages Router)
- React 19
- TypeScript (strict)
- Tailwind CSS v4 (no `tailwind.config.js` — uses `@theme` in CSS)
- shadcn/ui (Radix-based, configured in `components.json`)
- GSAP + @gsap/react (scroll animations, timelines)
- motion (motion.dev — **NOT** framer-motion) for springs and entry animations
- Geist Sans / Geist Mono (loaded via `next/font`)

---

## 2. Next.js 16 Breaking Changes

> Always read `node_modules/next/dist/docs/` before implementing any Next.js feature.

| What you know | What it is in Next.js 16 |
|---|---|
| `middleware.ts` | `proxy.ts` (same API, new name) |
| `router.refresh()` | `refresh()` from `next/cache` |
| `revalidatePath` | Still exists in `next/cache` |
| `cookies()` | Now async — must `await cookies()` |
| Server Actions | Called "Server Functions" (`'use server'`) |
| `useFormStatus` | Still from `react-dom` |

**Proxy file** (`proxy.ts`) guards protected routes. It is a first-line redirect check only —
every Server Function and Route Handler must independently verify auth.

---

## 3. Architecture Rules

### 3.1 Single Responsibility Principle (SRP)

Every file does one thing:
- **Components** — render UI, no business logic
- **Hooks** — encapsulate stateful logic, not UI
- **Server Functions** (`app/actions/`) — data mutations only
- **Route Handlers** (`app/api/`) — HTTP endpoints only
- **lib/** — pure utilities (no React, no Next.js imports)

### 3.2 Component Layers

```
app/                   <- Route segments (pages, layouts, loading, error)
  (public)/            <- Unauthenticated marketing pages
  (auth)/              <- Auth flows
  (dashboard)/         <- Authenticated app
    _components/       <- Route-group-specific components
app/actions/           <- Server Functions ('use server')
components/
  ui/                  <- shadcn primitives (generated, do not hand-edit)
  animations/          <- Reusable animation wrappers
  shared/              <- Cross-route reusable components
lib/
  utils.ts             <- cn() and other pure utilities
hooks/                 <- Custom React hooks
```

### 3.3 Server vs Client Components

- Default to **Server Components**. Add `"use client"` only when you need:
  - `useState`, `useEffect`, `useRef`, or any React hook
  - Browser APIs (window, document)
  - Event handlers
  - Animation libraries (GSAP, motion)
- Pass server-rendered children into client wrappers (the "island" pattern):
  ```tsx
  // page.tsx (Server)
  <AnimationWrapper>
    <ServerRenderedContent />
  </AnimationWrapper>
  ```
- Never import server-only modules in client components.

### 3.4 Reusability Rules

- **No one-off styles** — extract repeated patterns into utility classes in `globals.css`
- **No props drilling past 2 levels** — use composition or context
- **Animation components** in `components/animations/` are pure wrappers — they add motion but carry no business logic
- **shadcn components** in `components/ui/` are never hand-edited — extend via `className` or wrappers
- **Shared components** go in `components/shared/`, route-specific components in the route's `_components/` folder

---

## 4. Design System

> Full spec in `DESIGN.md`. Read it before building any UI.

### 4.1 Color Palette (dark-first)

```css
--primary: 258 90% 66%      /* violet #8b5cf6 */
--background: 240 10% 3.9%  /* #09090b near-black */
--card: 240 8% 6%
--muted: 240 5% 10%
--border: 240 5% 12%
```

All colors are Tailwind v4 utilities: `bg-background`, `text-primary`, `border-border`, etc.

### 4.2 Typography

- Body: Geist Sans via CSS variable `--font-sans`
- Code/metrics: Geist Mono via `--font-mono`
- Gradient on hero keywords: `.text-gradient` class
- Headings: `tracking-tight`, `font-semibold` or `font-bold`

### 4.3 Animation Standards (Emil Kowalski)

```
Button hover/press:  160ms, cubic-bezier(0.23, 1, 0.32, 1), scale(0.97) on :active
Tooltip/popover:     125-200ms
Dropdown:            150-250ms
Modal/sheet:         250-350ms
Scroll reveal:       600ms (marketing), GSAP ScrollTrigger, once: true
Entry animations:    motion.dev, spring or ease-out
```

**NEVER use:**
- `transition: all` — always specify the property
- `ease-in` — always ease-out or ease-in-out for visible elements
- CSS animations for scroll-triggered effects (use GSAP ScrollTrigger)
- framer-motion — **use `motion` from `"motion/react"` instead**

### 4.4 Imports

```ts
// Animation — scroll/timeline
import { gsap } from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { useGSAP } from "@gsap/react"

// Animation — entry/springs/gestures
import { motion, AnimatePresence } from "motion/react"

// Utilities
import { cn } from "@/lib/utils"

// shadcn
import { Button } from "@/components/ui/button"
```

---

## 5. SEO & AEO Requirements

### 5.1 Every Page Must Have

```tsx
export const metadata: Metadata = {
  title: "Page Title",          // unique, 50-60 chars
  description: "...",           // unique, 150-160 chars, primary keyword included
  openGraph: { ... },           // always include for social sharing
  twitter: { ... },
  alternates: { canonical: "https://saleboom.com/path" },
}
```

### 5.2 Semantic HTML

- One `<h1>` per page
- Logical heading hierarchy: h1 -> h2 -> h3 (never skip levels)
- Use landmark elements: `<main>`, `<section>`, `<article>`, `<nav>`, `<aside>`, `<footer>`
- `aria-label` on all interactive elements without visible text
- Images: always `alt`, prefer `next/image`

### 5.3 Structured Data (JSON-LD)

Add JSON-LD to key pages using a `<script type="application/ld+json">` tag with server-generated JSON content only (never user input). Required schemas:

- Landing page: `WebSite` + `SoftwareApplication`
- Blog/guides: `Article`
- FAQ sections: `FAQPage`

### 5.4 AEO (Answer Engine Optimization)

- Structure content in clear Q&A patterns for AI citation
- Use `<dl>`, `<dt>`, `<dd>` for definition-style content
- FAQ sections use explicit question headings + direct answer paragraphs
- Avoid vague marketing language — be factually specific (numbers, timeframes)
- Key claims should appear in the first 50 words of a section

### 5.5 Performance (Core Web Vitals)

- No layout shift: always specify `width`/`height` on images, reserve space for dynamic content
- `next/image` for all images
- `next/font` for all fonts (already configured)
- No client-side data fetching on initial render without Suspense
- Prefer Server Components; minimize client bundle size

---

## 6. Available Tools & Skills

> Use these before writing anything from scratch.

### Skills (invoke with Skill tool or `/skill-name`)

| Skill | When to use |
|---|---|
| `emil-design-eng` | All UI animation decisions |
| `gsap-react` | GSAP + React patterns (useGSAP, cleanup) |
| `gsap-scrolltrigger` | Scroll-linked animations |
| `gsap-timeline` | Animation sequences |
| `gsap-plugins` | ScrollSmoother, SplitText, etc. |
| `web-design-guidelines` | Accessibility + design audit |
| `shadcn-ui` | shadcn component discovery + install |
| `taste-design` | Premium anti-generic UI standards |
| `design-md` | Generate/update DESIGN.md |
| `brandkit` | Brand identity assets |
| `ui-ux-pro-max` | UI/UX design intelligence |
| `frontend-design` | Build polished UI components |

### MCP Servers

| Server | Purpose |
|---|---|
| `shadcn` (`.mcp.json`) | Component discovery, install commands |
| `context7` | Latest library documentation (always use before coding with any library) |
| `code-review-graph` | Impact analysis, architecture queries |

### Mandatory: Always Fetch Latest Docs

Before using any library, framework, or tool, use context7 to fetch the current documentation. Do not rely on training data for API shapes — they change.

---

## 7. Code Conventions

### 7.1 TypeScript

- Strict mode on (`tsconfig.json`)
- No `any` — use `unknown` + type narrowing
- Export types explicitly: `export type { Foo }`
- Server Function signatures: always typed `FormData` params

### 7.2 File Naming

- Components: `kebab-case.tsx`
- Hooks: `use-thing.ts`
- Server functions: `actions.ts` or `thing.actions.ts`
- Types: `types.ts` or co-located with the component

### 7.3 Commit Messages

Imperative, lowercase, no Claude/AI attribution:
```
feat: add scroll reveal animation wrapper
fix: correct sidebar active state detection
refactor: extract scan input into shared component
```

---

## 8. Quality Gates

Before marking any task complete:

1. `npx tsc --noEmit` — zero errors
2. `npm run lint` — zero warnings
3. `npm run dev` — page renders without console errors
4. Visual check: dark background, violet accent, animations fire
5. SEO check: page has metadata, h1, semantic HTML, JSON-LD if public
6. Accessibility: keyboard navigable, ARIA labels on interactive elements

---

## 9. What NOT to Do

- Do NOT use `middleware.ts` (use `proxy.ts`)
- Do NOT use `framer-motion` (use `motion` from `"motion/react"`)
- Do NOT use `tailwind.config.js` (use `@theme` in `globals.css`)
- Do NOT hand-edit files in `components/ui/` (use shadcn CLI)
- Do NOT use `transition: all` in CSS
- Do NOT use `ease-in` for any visible UI animation
- Do NOT skip structured data on public-facing pages
- Do NOT add comments that describe WHAT the code does (only WHY if non-obvious)
- Do NOT add Co-authored-by or AI attribution to commits

---

## Learned User Preferences

- Scan completion should email the website owner only; Slack alert channels are for admin/ops events, not product scan completion.
- Prefer a unified notification model: fixed transactional from address with dynamic per-event recipients, plus separate Slack and admin-email routing channels.
- Notifications transport (SMTP/Resend/SendGrid) should be configurable in Admin Providers, not only via Alert Channels.

## Learned Workspace Facts

- Transactional emails (scan complete, digest, auth, CMS push) use `infra_providers` type `notifications` via `getNotificationProvider()`; they do not use `notification_channels`.
- Admin/ops alerts (contact form, quality flags, health thresholds) use `notification_channels` via `dispatchToChannels()` (Slack webhook + email with `config.to`).
- Default transactional from address: `no-reply@saleboomllc.com`.
- `notification_channels` email dispatch silently skips when `config.to` is missing; Alert Channels UI historically saved SMTP transport without recipient addresses.
- `notifications` infra provider is absent from Admin Providers `INFRA_META`; unset DB row defaults to `mock` (console-only, no real delivery).
- Quick-fix badge means inherent rule-based fixes (meta, H1, alt, etc.) even without CMS; Apply/Fix-all stays blocked until CMS is connected.
- `probeAndReclassify` on CMS connect only reclassifies issues on the latest completed scan.
