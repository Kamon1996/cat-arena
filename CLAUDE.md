# cat-arena — Project Guide for Claude

Pairwise voting & **Glicko-2** rating site for **cat images** 🐱. Users upload cat photos; visitors
pick the better of two cats in 1-vs-1 duels; ratings update with Glicko-2. A smart pairing algorithm
maximizes how many different cats get rated. **Strong SEO is a primary goal.**

Hosting target: free tiers, but architected to survive a viral spike (image egress offloaded to Cloudflare R2/CDN).

## Stack (locked)
- **Next.js 15** (App Router, RSC, Server Actions) + **TypeScript** + **React** — deployed on **Vercel**
- **PostgreSQL** (Neon, serverless) + **Prisma** ORM
- **Cloudflare R2** + CDN for images (zero egress); `sharp` → WebP, 2–3 sizes
- **Cloudflare Workers AI** — NSFW / "is-it-a-cat" check on upload
- UI: **Tailwind CSS v4** + **CVA** + **shadcn/ui** (Radix primitives) + **Lucide** icons + **Sonner** toasts
- **Auth.js v5** + Prisma adapter — **magic-link** via **Resend** + **React Email**
  (login required only for *upload*; voting is anonymous, gateable later via a flag)
- **TanStack Query** — client data fetching (next pair, leaderboard)
- **React Hook Form** + **Zod** — forms & validation
- **Upstash Redis** — vote rate-limiting / anti-abuse
- **PostHog** (product analytics) + **Sentry** (errors/perf)
- **Motion** — duel/winner animations
- Tooling: **Biome** (lint+format JS/TS), **Stylelint** (CSS), **git-hooks** (pre-commit),
  **Vitest** + **React Testing Library** + **Playwright** (tests)

> Deliberately NOT using Supabase/Cloudinary: their free-tier egress caps would break a viral image site. R2 has no egress fee.

## Rating & pairing (core domain)
- Glicko-2 per image: `rating` (μ, start 1500), `rd` (350), `vol` (0.06). Update **both** images per vote.
- Leaderboard sorts by conservative **`score = μ − 2·rd`** (few votes ⇒ high rd ⇒ low score ⇒ can't top board on luck).
- Pairing: pick **A** weighted by high `rd` / low `timesShown`; pick **B** close in rating, excluding the
  voter's already-seen cats; add ε-randomness. **"Skip"** = new pair, no rating change.
- Vote integrity: **HMAC-signed pair token** (single-use) + Upstash rate-limit per voter/IP.
- Keep `rating/` and `pairing/` as **pure modules** with unit tests (reference Glicko-2 values).

## Code conventions (skills reference these — keep them satisfied)
- **Files:** kebab-case — `image-card.tsx`, `glicko2.ts`, `use-next-pair.ts`.
- **Exports:** named exports only (exception: Next.js `page`/`layout`/`route` files that require `default`).
- **Imports:** ordered (node builtins → external → internal `@/…` → relative); use `import type` for type-only imports.
- **Constants:** named constants, no magic numbers/strings.
- **Components:** small, single-purpose; build variants with **CVA**, not conditional class soup.
- **Validation:** validate all external input with **Zod** at the boundary (API handlers, server actions, forms).
- **Errors:** typed results at API boundaries; React error boundaries in the UI.

## Skill routing — load the matching skill BEFORE working in that area
Skills are vendored in `.claude/skills/` and load on demand. Before writing code in an area below,
open the matching skill and follow it. If several apply, load all relevant ones.

| When you are working on… | Load skill |
|---|---|
| Next.js routing, RSC, Server Actions, metadata/SEO, ISR, sitemap | `web-meta-framework-nextjs` |
| React components, hooks, patterns | `web-framework-react` |
| Tailwind styling | `web-styling-tailwind` |
| Component variants (CVA) | `web-styling-cva` |
| shadcn/ui components | `web-ui-shadcn-ui` |
| Radix primitives (dialog, dropdown, a11y) | `web-ui-radix-ui` |
| Prisma schema, queries, migrations | `api-database-prisma` |
| Neon Postgres connection/pooling | `api-baas-neon` |
| Auth.js, magic-link, sessions | `api-auth-nextauth` |
| Resend setup, domain/DNS verification | `api-email-setup-resend` |
| Email templates (React Email) | `api-email-resend-react-email` |
| File upload (presigned URLs, direct-to-R2) | `web-files-file-upload-patterns` |
| Client image preview / resize / EXIF | `web-files-image-handling` |
| Cloudflare R2 / Workers / Workers AI / edge | `infra-platform-cloudflare-workers` |
| Forms | `web-forms-react-hook-form` |
| Zod validation | `web-forms-zod-validation` |
| Client data fetching & caching | `web-server-state-react-query` |
| Rate limiting / Redis | `api-database-upstash` |
| Core Web Vitals / web performance | `web-performance-web-performance` |
| Accessibility | `web-accessibility-web-accessibility` |
| Unit tests | `web-testing-vitest` |
| Component tests | `web-testing-react-testing-library` |
| E2E tests | `web-testing-playwright-e2e` |
| Analytics setup (PostHog) | `api-analytics-setup-posthog` |
| Analytics events / usage | `api-analytics-posthog-analytics` |
| Error / perf monitoring (Sentry) | `api-observability-setup-axiom-pino-sentry`, `api-observability-axiom-pino-sentry` |
| Animations (Motion) | `web-animation-framer-motion` |
| Biome lint/format | `shared-tooling-biome` |
| Pre-commit hooks | `shared-tooling-git-hooks` |
| tsconfig | `shared-tooling-typescript-config` |
| Env vars / `.env` management | `infra-config-setup-env` |

## Stylelint (manual best-practice — no skill exists in agents-inc/skills)
Apply at scaffold time (needs `package.json` + Tailwind v4 installed):
- Install: `npm i -D stylelint stylelint-config-standard`
- `.stylelintrc.json`:
```json
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "at-rule-no-unknown": [true, {
      "ignoreAtRules": ["tailwind","apply","layer","theme","variant","custom-variant","utility","source","reference","config","plugin","screen"]
    }],
    "import-notation": "string",
    "no-descending-specificity": null
  },
  "ignoreFiles": ["**/*.{js,jsx,ts,tsx}", "node_modules/**", ".next/**"]
}
```
- Script: `"lint:css": "stylelint \"src/**/*.css\""`
- Formatting is owned by **Biome** (not Stylelint) — keep Stylelint for CSS *correctness* only; do **not** add `stylelint-prettier`/`stylelint-config-prettier`.
- Wire into the pre-commit hook alongside Biome (`shared-tooling-git-hooks`).

## Scripts (to be defined at scaffold)
`dev`, `build`, `start`, `test`, `test:e2e`, `lint` (Biome), `lint:css` (Stylelint), `typecheck`, `db:migrate`, `db:studio`.

## Skills source / updating
Skills are vendored from [`agents-inc/skills`](https://github.com/agents-inc/skills) (`src/skills/<name>`).
To refresh: download the repo tarball and re-copy the selected skill folders into `.claude/skills/`.
