# cat-arena — External Services Setup

Phase 01 (scaffold) is done and on `main`. Phases 02–08 need the external services below
(all have free tiers). Fill each value into **`.env.local`** (gitignored; already created with
`AUTH_SECRET` + `PAIR_TOKEN_SECRET` pre-generated). The full list of keys is in [`.env.example`](../.env.example).

> **Minimum to unblock phase 02 (DB + Glicko-2):** just **Neon**. The rest can come as we reach their phase.

## ✅ Already generated (no action)
- `AUTH_SECRET`, `PAIR_TOKEN_SECRET` — random secrets, already in `.env.local`.

## 1. Neon — Postgres (phase 02) — REQUIRED FIRST
1. Sign up at https://neon.tech → create a project (region near you).
2. In the project's **Connection Details**, copy two strings:
   - **Pooled** connection (has `-pooler` in host) → `DATABASE_URL`
   - **Direct** connection (no `-pooler`) → `DIRECT_URL`
3. Append `?sslmode=require` if not present.

## 2. Upstash — Redis for rate-limiting (phase 03)
1. https://upstash.com → create a **Redis** database (Global/Regional, free tier).
2. From the REST API section: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.

## 3. Resend — magic-link emails (phase 05)
1. https://resend.com → API Keys → create → `RESEND_API_KEY`.
2. Add & verify a sending domain (DNS records), then set `EMAIL_FROM`, e.g. `Cat Arena <login@yourdomain>`.
   (For local testing without a domain, Resend allows sending to your own address from `onboarding@resend.dev`.)
3. `AUTH_URL` = your app URL (local: `http://localhost:3000`).

## 4. Cloudflare R2 — image storage (phase 06)
1. Cloudflare dashboard → **R2** → create a bucket → set `R2_BUCKET`.
2. R2 → Manage **API Tokens** → create (Object Read & Write) → `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
3. `R2_ACCOUNT_ID` = your Cloudflare account id.
4. Enable public access / connect a custom domain for the bucket → `R2_PUBLIC_URL` (the public CDN base).

## 5. Cloudflare Workers AI — NSFW / "is-it-a-cat" screen (phase 06)
1. Same Cloudflare account → `CLOUDFLARE_ACCOUNT_ID` (same as R2 account id).
2. My Profile → **API Tokens** → create a token with **Workers AI** read permission → `CLOUDFLARE_API_TOKEN`.

## 6. PostHog — analytics (phase 08)
1. https://posthog.com → project → `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (e.g. `https://eu.i.posthog.com`).

## 7. Sentry — error/perf monitoring (phase 08)
1. https://sentry.io → create a **Next.js** project → copy the DSN → `SENTRY_DSN`.

---

When you've filled `.env.local` (at least Neon), tell me and I'll resume execution from **phase 02**
(`docs/superpowers/plans/2026-06-02-02-data-rating.md`) onward, subagent-driven, through phase 08.
