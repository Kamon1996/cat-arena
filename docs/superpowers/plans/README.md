# cat-arena — Implementation Plans Index

Phased, independently-testable implementation plans derived from the approved spec
([`../specs/2026-06-02-cat-arena-design.md`](../specs/2026-06-02-cat-arena-design.md)).
Each phase produces working, tested software and builds on the previous one.

**Execute in order.** Per each plan's header, use `superpowers:subagent-driven-development`
(recommended) or `superpowers:executing-plans` to run it task-by-task. Follow `/CLAUDE.md`:
before coding in any area, load the matching skill from `.claude/skills/`.

| # | Plan | Produces |
|---|---|---|
| 00 | [contracts](2026-06-02-00-contracts.md) | **Canonical contracts** — Prisma schema, file structure, module signatures, constants, env, route shapes. Source of truth for 01–08. |
| 01 | [scaffold](2026-06-02-01-scaffold.md) | Next.js 15 + TS, Tailwind v4 + CVA + shadcn, Biome + Stylelint + git-hooks, Vitest + RTL + Playwright, typed env. App builds, checks pass. |
| 02 | [data-rating](2026-06-02-02-data-rating.md) | Prisma + Neon, full schema + migration + seed; pure Glicko-2 module (TDD). |
| 03 | [pairing-integrity](2026-06-02-03-pairing-integrity.md) | `pickPair` (global/org scope), HMAC pair token, Upstash rate-limit. |
| 04 | [voting-ui](2026-06-02-04-voting-ui.md) | `GET /api/pair`, `POST /api/vote` (global + shared-org Glicko update), duel UI with carousel + Motion + skip. |
| 05 | [auth](2026-06-02-05-auth.md) | Auth.js v5 magic-link (Resend + React Email), DB sessions, **3-role RBAC**, guards. |
| 06 | [upload-moderation](2026-06-02-06-upload-moderation.md) | Presigned R2 upload, `sharp` thumb/card + EXIF strip + WebP, Workers AI/NSFWJS screen, reports, `/admin` queue. |
| 07 | [organizations](2026-06-02-07-organizations.md) | `Organization`/`CatOrg`, create org (≤1/user), join-by-code (≤2/cat), `/org/[slug]` feed + leaderboard, local rating. |
| 08 | [seo-analytics](2026-06-02-08-seo-analytics.md) | `/cat/[slug]`, `/top`, sitemap/robots, OG + JSON-LD, CDN image strategy, CWV/a11y, PostHog + Sentry. |

## Canonical cross-plan decisions (reconciled during self-review)

These were normalized so signatures match across phases — follow them verbatim:

- **3-role RBAC.** `User.role` is the Prisma `enum Role { USER MODERATOR ADMIN }` (default `USER`).
  Guards in `src/auth/guards.ts`: `requireUser()` (any session), `requireModerator()` (`MODERATOR`|`ADMIN`),
  `requireAdmin()` (`ADMIN` only). `/upload` & `/orgs/new` → `requireUser`; `/admin` and all moderation
  actions → `requireModerator`. Role values are uppercase (`"USER"`/`"MODERATOR"`/`"ADMIN"`).
- **Image URLs.** `publicUrl(key)` lives in `@/lib/r2`; `cardUrl(imageId)` / `thumbUrl(imageId)` live in
  `@/storage/keys` (they derive the key then call `publicUrl`). Use these names everywhere.
- **Org indexing threshold.** `ORG_MIN_INDEXABLE_MEMBERS = 3` is defined once in `src/lib/constants.ts`
  by phase 07; phase 08 imports it (does not redefine).

## Follow-ups (intentionally NOT in the current phase plans)

- **ADMIN-only admin surface:** assigning roles to users and banning users (the `ADMIN`-only powers from
  the spec) — `requireAdmin()` exists for them, but a UI/endpoint is not yet planned. Add a small admin
  plan when needed.
- **Duel image size:** `GET /api/pair` currently returns `publicUrl(image.r2Key)` (the original). For best
  Core Web Vitals it should serve the card size — switch to `cardUrl(image.id)` when wiring phase 04↔06
  (the card variant is produced at upload in phase 06).
- **Org-vs-org global ranking** (aggregate organization rating) — post-MVP per spec §16.

## Tuning knobs (defaults; revisit on real data)

`MAX_CATS_PER_USER=2`, `MAX_IMAGES_PER_CAT=3`, `MAX_ORGS_PER_USER=1`, `MAX_ORGS_PER_CAT=2`,
`ORG_MIN_INDEXABLE_MEMBERS=3`, Glicko defaults `1500/350/0.06`, image sizes `thumb 200 / card 800`,
rate-limit / report / NSFW thresholds — all in `src/lib/constants.ts`.
