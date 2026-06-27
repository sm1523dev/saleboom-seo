# SaleBoom SEO — Design System

> Source of truth for all visual decisions. Referenced by AGENTS.md.
> Update this file using the `design-md` skill, not by hand.

---

## Aesthetic

**AI-alive, dark, premium.** The product should feel like an intelligent system that is actively watching and improving your web presence. Reference: Perplexity, Linear, Vercel, Anthropic.

Anti-patterns to avoid:
- Generic SaaS blue-and-white
- Drop shadows that look like 2018 material design
- Gradients that look like a CSS tutorial
- Animations that serve no purpose or feel mechanical

---

## Color System

All colors are defined as HSL values in `globals.css` and exposed via Tailwind v4 `@theme inline`.

### Core Palette

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--background` | 240 10% 3.9% | `#09090b` | Page background |
| `--foreground` | 0 0% 98% | `#fafafa` | Primary text |
| `--card` | 240 8% 6% | `#0f0f12` | Card surfaces |
| `--card-foreground` | 0 0% 98% | `#fafafa` | Text on cards |
| `--border` | 240 5% 12% | `#1c1c1f` | Borders, dividers |
| `--input` | 240 5% 12% | `#1c1c1f` | Input backgrounds |
| `--muted` | 240 5% 10% | `#17171a` | Muted surfaces |
| `--muted-foreground` | 240 5% 55% | `#808086` | Secondary text |

### Brand Accent

| Token | HSL | Hex | Usage |
|---|---|---|---|
| `--primary` | 258 90% 66% | `#8b5cf6` | Violet — primary actions, active states |
| `--primary-foreground` | 0 0% 100% | `#ffffff` | Text on primary |
| `--accent` | 258 70% 20% | `#2e1a6b` | Dark violet surface — hover bg |
| `--accent-foreground` | 0 0% 98% | `#fafafa` | Text on accent |
| `--ring` | 258 90% 66% | `#8b5cf6` | Focus rings |

### Semantic

| Token | HSL | Usage |
|---|---|---|
| `--destructive` | 0 72% 51% | Errors, delete actions |
| `--secondary` | 240 5% 10% | Secondary buttons, badges |

---

## Typography

### Fonts

- **Body**: Geist Sans — `font-family: var(--font-sans)`
- **Code/Metrics**: Geist Mono — `font-family: var(--font-mono)`

Both loaded via `next/font/google` in `app/layout.tsx`. Use CSS variables, not raw font names.

### Scale

| Usage | Classes | Notes |
|---|---|---|
| Hero H1 | `text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight` | |
| Section H2 | `text-3xl font-semibold tracking-tight` | |
| Card H3 | `text-lg font-semibold` | |
| Body | `text-base` | default |
| Small/Caption | `text-sm text-muted-foreground` | |
| Metrics | `text-3xl font-bold font-mono` | CountUp numbers |
| Badges/Labels | `text-xs font-medium` | |

### Gradient Text

Apply `.text-gradient` class to keyword words in hero headlines (e.g., "AI").

```css
.text-gradient {
  background: linear-gradient(135deg, hsl(258 90% 80%) 0%, hsl(220 90% 70%) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
```

---

## Spacing & Layout

- Container max width: `max-w-5xl` (1024px) for content, `max-w-sm` (384px) for cards
- Section padding: `py-24 px-4`
- Card padding: `p-6` (standard), `p-8` (auth card)
- Gap between cards: `gap-6`
- Component internal spacing: `space-y-4` for form fields, `space-y-1` for label+value pairs

---

## Elevation & Surfaces

### Card Surface
```
bg-card border border-border rounded-xl
```

### Glass Surface (auth, modals)
```
glass rounded-2xl border border-border
```
CSS: `background: hsl(var(--card) / 0.8); backdrop-filter: blur(12px)`

### Input Surface
```
bg-secondary/50 border border-border
```

---

## Motion System

> Based on Emil Kowalski's animation philosophy. Read the `emil-design-eng` skill.

### Easing Tokens

```css
--ease-out:    cubic-bezier(0.23, 1, 0.32, 1);   /* most UI transitions */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);  /* full-screen transitions */
--ease-spring: cubic-bezier(0.32, 0.72, 0, 1);   /* drawer/panel entry */
```

### Duration Guide

| Element | Duration | Library |
|---|---|---|
| Button press feedback | 160ms | CSS |
| Hover state | 150-200ms | CSS |
| Tooltip/popover | 125-200ms | CSS / motion |
| Dropdown | 150-250ms | motion |
| Modal/sheet | 250-350ms | motion |
| Scroll reveal (marketing) | 600ms | GSAP |
| Hero text stagger | 500ms total, 40ms per word | GSAP |
| Count-up numbers | 1500ms | GSAP |

### Patterns

**Button press (CSS only)**:
```css
.btn-press { transition: transform 160ms var(--ease-out); }
.btn-press:active { transform: scale(0.97); }
```

**Card hover glow (CSS only)**:
```css
.card-glow { transition: box-shadow 200ms var(--ease-out), border-color 200ms var(--ease-out); }
.card-glow:hover {
  box-shadow: 0 0 30px hsl(var(--primary) / 0.12);
  border-color: hsl(var(--primary) / 0.3);
}
```

**Entry animation (motion.dev)**:
```tsx
import { motion } from "motion/react"
<motion.div
  initial={{ opacity: 0, scale: 0.97 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
/>
```

**Scroll reveal (GSAP)**:
```tsx
import { ScrollReveal } from "@/components/animations/scroll-reveal"
<ScrollReveal delay={0.1}>
  <YourContent />
</ScrollReveal>
```

**Stagger reveal (GSAP)**:
```tsx
import { StaggerChildren } from "@/components/animations/stagger-children"
<StaggerChildren className="grid grid-cols-3 gap-6">
  <Card />
  <Card />
  <Card />
</StaggerChildren>
```

**Count-up metric (GSAP)**:
```tsx
import { CountUp } from "@/components/animations/count-up"
<CountUp to={94} suffix="/100" />
```

### Reduced Motion

Always respect `prefers-reduced-motion`. It's handled globally in `globals.css`. GSAP animations should additionally check:
```ts
const mm = gsap.matchMedia()
mm.add("(prefers-reduced-motion: no-preference)", () => { /* animate */ })
```

---

## Component Patterns

### Hero Section
- Full-screen, flex column, centered
- `bg-grid` overlay (subtle SVG grid, 4% white opacity)
- `.hero-glow` radial gradient (violet, from bottom)
- Badge pill → H1 with gradient word → subtitle → CTA

### Navigation (Sidebar)
- Width: `w-56`
- Background: `bg-card`
- Right border: `border-r border-border`
- Active nav item: left border `border-l-2 border-primary` + `bg-accent`
- Hover: `hover:bg-accent` + 150ms transition

### Form Inputs
- `input-glow` class for focus state
- `bg-secondary/50 border-border` for dark input surface
- Always `Label` above input, always `aria-label` if no visible label

### Empty States
- Centered in a `rounded-xl border border-border bg-card p-12` container
- Icon with `.animate-breathe` class
- Heading + description + CTA button

---

## SEO/AEO Visual Patterns

- Every FAQ section should have visible numbered questions + concise answers
- Metric callouts (e.g., "50+ checks") in a styled badge: `bg-primary/10 text-primary text-xs font-semibold`
- Definition terms: `<dt>` bold, `<dd>` normal weight, both in `<dl>`
- Social proof / stats should be specific numbers, not percentages alone
