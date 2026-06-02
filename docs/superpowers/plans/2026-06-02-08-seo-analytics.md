# SEO & Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make every cat and the leaderboard deeply indexable — ISR `/cat/[slug]` and `/top` pages with full Metadata + Open Graph/Twitter cards (dynamic OG images via `next/og`), JSON-LD (`ImageGallery`/`ImageObject`, `BreadcrumbList`, `ItemList`), a dynamic `sitemap.ts` (APPROVED cats + qualifying org pages) and `robots.ts`, a CDN-direct `next/image` loader that bypasses Vercel optimization quota, a Core-Web-Vitals + accessibility pass, plus PostHog vote-funnel analytics and Sentry error/perf monitoring.
**Architecture:** Pages are React Server Components rendered with ISR (`export const revalidate`), reading APPROVED data through the Prisma singleton and turning R2 keys into CDN URLs via `@/lib/r2` + `@/storage/keys`. Images render through a custom `next/image` loader so bytes always come straight from R2/CDN (zero Vercel optimization quota), with explicit `width`/`height` to keep CLS at zero. SEO surfaces (metadata, OG image, JSON-LD, sitemap, robots) are colocated with their routes. Analytics is a thin `@/lib/analytics` layer wrapping a browser PostHog provider wired into the existing duel hooks (`pair_served`/`vote_cast`/`skip`), and Sentry is initialized via its Next.js SDK (client/server/edge configs + `instrumentation.ts`).
**Tech Stack:** Next.js 15 App Router (RSC + ISR, Metadata API, `next/og` `ImageResponse`, `next/image` custom loader, `MetadataRoute.Sitemap`/`Robots`), Prisma + Neon, `posthog-js` + `posthog-js/react`, `@sentry/nextjs`, Vitest, Playwright.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/constants.ts` | (MODIFY) add SEO/analytics constants: `SITE_URL`, `SITE_NAME`, `OG_SIZE`, `ISR_REVALIDATE_SECONDS`, `TOP_LEADERBOARD_LIMIT`, `RECENT_DUELS_LIMIT`, `ORG_MIN_INDEXABLE_MEMBERS`, PostHog event names |
| `src/lib/site.ts` | Canonical absolute-URL helpers (`absoluteUrl`, `catPath`, `orgPath`) built from `SITE_URL` |
| `src/lib/site.test.ts` | Vitest: URL composition + trailing-slash normalization |
| `src/lib/seo.ts` | Pure JSON-LD builders: `catJsonLd` (ImageGallery + BreadcrumbList), `leaderboardJsonLd` (ItemList) |
| `src/lib/seo.test.ts` | Vitest: builders emit valid `@type` / `@context` and item ordering |
| `src/lib/cat-image-loader.ts` | Custom `next/image` loader → R2/CDN URL (bypasses Vercel optimization) |
| `src/lib/cat-image-loader.test.ts` | Vitest: loader returns the CDN URL untouched (absolute) / via `publicUrl` (key) |
| `src/components/seo/json-ld.tsx` | `<JsonLd>` server component that renders a `<script type="application/ld+json">` |
| `src/components/cat/cdn-image.tsx` | `next/image` wrapper using the custom loader + required width/height + lazy default |
| `src/data/cat-page.ts` | Server data loader: APPROVED cat by slug with rank, images, recent duels |
| `src/data/leaderboard.ts` | Server data loader: top APPROVED cats by score (rank order) |
| `src/data/indexable.ts` | Server loaders for sitemap: APPROVED cat slugs + qualifying org slugs |
| `src/components/cat/cat-detail.tsx` | `/cat/[slug]` body: carousel (alt text), rank, rating, W/L, recent duels |
| `src/app/cat/[slug]/page.tsx` | `/cat/[slug]` ISR page + `generateMetadata` + `generateStaticParams` + JSON-LD |
| `src/app/cat/[slug]/opengraph-image.tsx` | Dynamic OG image for a cat via `next/og` `ImageResponse` |
| `src/app/cat/[slug]/not-found.tsx` | 404 UI for missing/non-APPROVED cats |
| `src/app/top/page.tsx` | `/top` ISR leaderboard + Metadata + JSON-LD `ItemList` |
| `src/app/sitemap.ts` | Dynamic `sitemap.xml`: home, `/top`, APPROVED cats, qualifying org pages |
| `src/app/robots.ts` | `robots.txt` allowing crawl, disallowing private routes, pointing at the sitemap |
| `src/lib/analytics.ts` | Typed PostHog event names + `captureEvent` helper (client-only, no PII) |
| `src/components/providers/posthog-provider.tsx` | Browser PostHog init provider |
| `src/app/layout.tsx` | (MODIFY) root Metadata template + `metadataBase`, wrap tree in `PostHogProvider` |
| `src/hooks/use-next-pair.ts` | (MODIFY) capture `pair_served` when a pair arrives |
| `src/hooks/use-submit-vote.ts` | (MODIFY) capture `vote_cast` on success |
| `src/components/duel/skip-button.tsx` | (MODIFY) capture `skip` on click |
| `next.config.ts` | (MODIFY) custom image loader config + `withSentryConfig` wrapper |
| `instrumentation.ts` | Sentry runtime init (nodejs/edge) + `onRequestError` |
| `sentry.client.config.ts` | Client Sentry init |
| `sentry.server.config.ts` | Server Sentry init |
| `sentry.edge.config.ts` | Edge Sentry init |
| `e2e/cat-page.spec.ts` | Playwright: `/cat/[slug]` title/metadata + JSON-LD parses with expected `@type` |
| `e2e/top.spec.ts` | Playwright: `/top` title/metadata + `ItemList` JSON-LD |
| `e2e/sitemap.spec.ts` | Playwright: sitemap includes an APPROVED cat URL, excludes a PENDING one |

Assumed present from phases 01-07 (DO NOT recreate): `src/lib/prisma.ts` (`prisma`), `src/lib/env.ts` (`env`), `src/lib/r2.ts` (`publicUrl(key)`), `src/storage/keys.ts` (`cardUrl(imageId)`, `thumbUrl(imageId)`), `src/lib/constants.ts` (§4 contract constants + voting-flow constants), `src/hooks/use-next-pair.ts` / `src/hooks/use-submit-vote.ts` / `src/components/duel/skip-button.tsx` (phase 04), `src/app/layout.tsx` (phase 04 wraps `QueryProvider` + `MotionConfig`), Prisma models `Cat`/`CatImage`/`Vote`/`Organization`/`CatOrg`, `playwright.config.ts` with `webServer` → `npm run dev`, Vitest + Biome config, scripts `test`/`test:e2e`/`lint`/`lint:css`/`typecheck`.

> **next/image strategy (decision, implemented in Task 3 + Task 14):** R2 images are already pre-rendered to fixed WebP sizes (`thumb` 200 / `card` 800) by phase 06 `sharp`, and the CDN serves them with zero egress cost. Routing them through Vercel's image optimizer would burn the (limited) free optimization quota for no benefit. We therefore configure a **custom `next/image` loader** (`images.loader: "custom"`, `images.loaderFile`) that returns the R2/CDN URL verbatim. `next/image` still gives us lazy-loading, `sizes`, `srcset` slots, and — critically — **required `width`/`height`** so layout is reserved and CLS stays at 0. We never use `unoptimized` globally (it would drop the width/height ergonomics); the loader is the surgical choice.

---

### Task 1: SEO & analytics constants

**Files:**
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (Metadata API section). Per CLAUDE.md every literal below is a named constant (no magic numbers/strings); downstream metadata, sitemap, and analytics import these.
- [ ] **Step 2: Append SEO/analytics constants to `src/lib/constants.ts`**
  Add to the END of the existing file (do not touch the §4 contract exports or the phase-04 voting-flow exports):
  ```ts
  // ── Site identity / SEO ──────────────────────────────────────────
  // Canonical origin (no trailing slash); env-overridable for previews.
  export const SITE_URL =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://cat-arena.app";
  export const SITE_NAME = "Cat Arena";
  export const SITE_LOCALE = "ru_RU";
  export const SITE_DESCRIPTION =
    "Голосуй в дуэлях котиков и смотри рейтинг по Glicko-2.";

  // Open Graph image canvas (next/og ImageResponse).
  export const OG_SIZE = { width: 1200, height: 630 } as const;

  // ISR: how often cat/leaderboard pages and the sitemap revalidate.
  export const ISR_REVALIDATE_SECONDS = 60 * 60; // 1 hour

  // Leaderboard / cat-page list sizes.
  export const TOP_LEADERBOARD_LIMIT = 100;
  export const RECENT_DUELS_LIMIT = 10;

  // Org-page indexing threshold ORG_MIN_INDEXABLE_MEMBERS is ALREADY defined in
  // src/lib/constants.ts by phase 07 (Organizations) = 3 — import it where needed; do NOT redefine here.

  // ── Analytics: PostHog vote-funnel event names (category:object_action) ──
  export const ANALYTICS_EVENT = {
    PAIR_SERVED: "duel:pair_served",
    VOTE_CAST: "duel:vote_cast",
    SKIP: "duel:skip",
  } as const;
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors (constants are plain literals; existing code still compiles).
- [ ] **Step 4: Commit**
  Run: `git add src/lib/constants.ts && git commit -m "feat(constants): SEO, ISR, leaderboard, org-indexable, and analytics event constants"`
  Expected: one commit created.

---

### Task 2: Canonical URL helpers (`src/lib/site.ts`)

**Files:**
- Create: `src/lib/site.ts`
- Test: `src/lib/site.test.ts`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — read the Metadata API / canonical-URL notes in `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md`. Canonical URLs must be absolute and derived from one source (`SITE_URL`); these helpers feed `alternates.canonical`, sitemap, and JSON-LD.
- [ ] **Step 2: Write the failing test `src/lib/site.test.ts`**
  ```ts
  import { describe, expect, it } from "vitest";

  import { SITE_URL } from "@/lib/constants";
  import { absoluteUrl, catPath, orgPath } from "@/lib/site";

  describe("site urls", () => {
    it("builds absolute urls and normalizes the leading slash", () => {
      expect(absoluteUrl("/top")).toBe(`${SITE_URL}/top`);
      expect(absoluteUrl("top")).toBe(`${SITE_URL}/top`);
    });

    it("composes cat and org canonical paths", () => {
      expect(catPath("fluffy-abc123")).toBe("/cat/fluffy-abc123");
      expect(orgPath("acme-cats")).toBe("/org/acme-cats");
      expect(absoluteUrl(catPath("fluffy-abc123"))).toBe(
        `${SITE_URL}/cat/fluffy-abc123`,
      );
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/lib/site.test.ts`
  Expected: FAIL — `Cannot find module '@/lib/site'`.
- [ ] **Step 4: Write the implementation `src/lib/site.ts`**
  ```ts
  import { SITE_URL } from "@/lib/constants";

  /** Absolute canonical URL for a site-relative path (leading slash optional). */
  export function absoluteUrl(path: string): string {
    const normalized = path.startsWith("/") ? path : `/${path}`;
    return `${SITE_URL}${normalized}`;
  }

  /** Canonical site-relative path for a cat page. */
  export function catPath(slug: string): string {
    return `/cat/${slug}`;
  }

  /** Canonical site-relative path for an organization page. */
  export function orgPath(slug: string): string {
    return `/org/${slug}`;
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/lib/site.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/lib/site.ts src/lib/site.test.ts && git commit -m "feat(seo): canonical absolute-URL and path helpers"`
  Expected: one commit created.

---

### Task 3: Custom CDN image loader + `<CdnImage>` wrapper

**Files:**
- Create: `src/lib/cat-image-loader.ts`
- Test: `src/lib/cat-image-loader.test.ts`
- Create: `src/components/cat/cdn-image.tsx`

- [ ] **Step 1: Load skill web-performance-web-performance and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-performance-web-performance/SKILL.md` (image optimization + CLS). Takeaways applied: images come straight from the CDN (no Vercel optimizer quota), every `<Image>` carries explicit `width`/`height` to reserve layout (CLS = 0), and only the LCP image is eager — everything else lazy. Also re-read web-meta-framework-nextjs (custom loaders are configured in `next.config.ts`).
- [ ] **Step 2: Write the failing test `src/lib/cat-image-loader.test.ts`**
  ```ts
  import { describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/r2", () => ({
    publicUrl: (key: string) => `https://cdn.test/${key}`,
  }));

  import { catImageLoader } from "@/lib/cat-image-loader";

  describe("catImageLoader", () => {
    it("returns an already-absolute CDN url unchanged", () => {
      expect(
        catImageLoader({ src: "https://cdn.test/cats/x/card.webp", width: 800 }),
      ).toBe("https://cdn.test/cats/x/card.webp");
    });

    it("resolves a bare r2 key through publicUrl", () => {
      expect(catImageLoader({ src: "cats/x/card.webp", width: 800 })).toBe(
        "https://cdn.test/cats/x/card.webp",
      );
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/lib/cat-image-loader.test.ts`
  Expected: FAIL — `Cannot find module '@/lib/cat-image-loader'`.
- [ ] **Step 4: Write the loader `src/lib/cat-image-loader.ts`**
  The loader signature matches Next.js `ImageLoaderProps` (`{ src, width, quality? }`). Because R2 derivatives are pre-sized, we ignore `width`/`quality` and return the CDN URL verbatim — no Vercel optimization round-trip.
  ```ts
  import { publicUrl } from "@/lib/r2";

  type CatImageLoaderProps = {
    src: string;
    width: number;
    quality?: number;
  };

  /**
   * next/image custom loader. R2 already serves pre-sized WebP variants from a
   * zero-egress CDN, so we bypass Vercel image optimization entirely and return
   * the CDN URL. Accepts either an absolute CDN URL or a bare R2 key.
   */
  export function catImageLoader({ src }: CatImageLoaderProps): string {
    if (src.startsWith("http://") || src.startsWith("https://")) {
      return src;
    }
    return publicUrl(src);
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/lib/cat-image-loader.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Write the `<CdnImage>` wrapper `src/components/cat/cdn-image.tsx`**
  ```tsx
  import Image from "next/image";

  import { catImageLoader } from "@/lib/cat-image-loader";

  type CdnImageProps = {
    src: string; // absolute CDN url or bare r2 key
    alt: string;
    width: number;
    height: number;
    sizes?: string;
    priority?: boolean;
    className?: string;
  };

  /**
   * next/image wrapper bound to the CDN loader. Requires width/height so the
   * browser reserves layout (CLS = 0). Lazy by default; set priority on the LCP
   * image only.
   */
  export function CdnImage({
    src,
    alt,
    width,
    height,
    sizes,
    priority = false,
    className,
  }: CdnImageProps) {
    return (
      <Image
        loader={catImageLoader}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        className={className}
      />
    );
  }
  ```
- [ ] **Step 7: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 8: Commit**
  Run: `git add src/lib/cat-image-loader.ts src/lib/cat-image-loader.test.ts src/components/cat/cdn-image.tsx && git commit -m "feat(perf): custom CDN next/image loader + CdnImage wrapper (bypass Vercel optimization)"`
  Expected: one commit created.

---

### Task 4: JSON-LD builders (`src/lib/seo.ts`)

**Files:**
- Create: `src/lib/seo.ts`
- Test: `src/lib/seo.test.ts`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (Metadata/SEO). JSON-LD is injected via a `<script type="application/ld+json">` (Task 5 component) — never manual `<head>` mutation. Builders are pure functions of already-loaded data so they unit-test without a DB.
- [ ] **Step 2: Write the failing test `src/lib/seo.test.ts`**
  ```ts
  import { describe, expect, it } from "vitest";

  import { SITE_URL } from "@/lib/constants";
  import { catJsonLd, leaderboardJsonLd } from "@/lib/seo";

  const CAT = {
    name: "Fluffy",
    slug: "fluffy-abc123",
    images: [
      { url: "https://cdn.test/cats/a/card.webp", width: 800, height: 600 },
      { url: "https://cdn.test/cats/b/card.webp", width: 800, height: 600 },
    ],
  };

  describe("catJsonLd", () => {
    it("emits an ImageGallery with ImageObject members and a BreadcrumbList", () => {
      const ld = catJsonLd(CAT);
      const graph = ld["@graph"] as Array<Record<string, unknown>>;
      const gallery = graph.find((n) => n["@type"] === "ImageGallery");
      const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList");

      expect(ld["@context"]).toBe("https://schema.org");
      expect(gallery?.name).toBe("Fluffy");
      expect((gallery?.image as unknown[]).length).toBe(2);
      expect(
        (gallery?.image as Array<Record<string, unknown>>)[0]["@type"],
      ).toBe("ImageObject");
      expect(
        (crumbs?.itemListElement as Array<Record<string, unknown>>).at(-1)?.[
          "item"
        ],
      ).toBe(`${SITE_URL}/cat/fluffy-abc123`);
    });
  });

  describe("leaderboardJsonLd", () => {
    it("emits an ItemList in rank order", () => {
      const ld = leaderboardJsonLd([
        { name: "A", slug: "a-1" },
        { name: "B", slug: "b-2" },
      ]);
      expect(ld["@type"]).toBe("ItemList");
      const items = ld.itemListElement as Array<Record<string, unknown>>;
      expect(items[0].position).toBe(1);
      expect(items[0].url).toBe(`${SITE_URL}/cat/a-1`);
      expect(items[1].position).toBe(2);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/lib/seo.test.ts`
  Expected: FAIL — `Cannot find module '@/lib/seo'`.
- [ ] **Step 4: Write the implementation `src/lib/seo.ts`**
  ```ts
  import { SITE_NAME, SITE_URL } from "@/lib/constants";
  import { absoluteUrl, catPath } from "@/lib/site";

  const SCHEMA_CONTEXT = "https://schema.org";
  const FIRST_RANK = 1;

  export type CatJsonLdInput = {
    name: string;
    slug: string;
    images: { url: string; width: number; height: number }[];
  };

  export type LeaderboardItem = {
    name: string;
    slug: string;
  };

  /** ImageGallery (with ImageObject members) + BreadcrumbList for a cat page. */
  export function catJsonLd(cat: CatJsonLdInput): Record<string, unknown> {
    const canonical = absoluteUrl(catPath(cat.slug));
    return {
      "@context": SCHEMA_CONTEXT,
      "@graph": [
        {
          "@type": "ImageGallery",
          name: cat.name,
          url: canonical,
          image: cat.images.map((img) => ({
            "@type": "ImageObject",
            contentUrl: img.url,
            width: img.width,
            height: img.height,
            name: cat.name,
          })),
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: FIRST_RANK,
              name: SITE_NAME,
              item: SITE_URL,
            },
            {
              "@type": "ListItem",
              position: FIRST_RANK + 1,
              name: cat.name,
              item: canonical,
            },
          ],
        },
      ],
    };
  }

  /** ItemList of the leaderboard, in rank order (position starts at 1). */
  export function leaderboardJsonLd(
    items: LeaderboardItem[],
  ): Record<string, unknown> {
    return {
      "@context": SCHEMA_CONTEXT,
      "@type": "ItemList",
      name: `${SITE_NAME} — топ котиков`,
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + FIRST_RANK,
        name: item.name,
        url: absoluteUrl(catPath(item.slug)),
      })),
    };
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/lib/seo.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/lib/seo.ts src/lib/seo.test.ts && git commit -m "feat(seo): JSON-LD builders for cat ImageGallery/BreadcrumbList and leaderboard ItemList"`
  Expected: one commit created.

---

### Task 5: `<JsonLd>` server component

**Files:**
- Create: `src/components/seo/json-ld.tsx`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — (already loaded.) JSON-LD is rendered as a `<script type="application/ld+json">` inside a Server Component (no `"use client"`); Next.js recommends `dangerouslySetInnerHTML` with `JSON.stringify` for structured data.
- [ ] **Step 2: Write the component `src/components/seo/json-ld.tsx`** (no unit test — it is a one-line render exercised by the e2e JSON-LD parse in Tasks 12/13)
  ```tsx
  type JsonLdProps = {
    data: Record<string, unknown>;
  };

  /** Injects a schema.org JSON-LD block. Server Component only. */
  export function JsonLd({ data }: JsonLdProps) {
    return (
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD requires raw script content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    );
  }
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 4: Commit**
  Run: `git add src/components/seo/json-ld.tsx && git commit -m "feat(seo): JsonLd server component"`
  Expected: one commit created.

---

### Task 6: Server data loaders (`src/data/*`)

**Files:**
- Create: `src/data/cat-page.ts`
- Create: `src/data/leaderboard.ts`
- Create: `src/data/indexable.ts`
- Test: `src/data/cat-page.test.ts`

A cat is publicly indexable iff `status = ACTIVE` (contracts: ACTIVE + ≥1 APPROVED image enters duels; APPROVED-image presence is implied by ACTIVE per phase 06 promotion). Pages/sitemap show only `CatStatus.ACTIVE` cats and `ImageStatus.APPROVED` images. Rank = count of ACTIVE cats with a strictly higher `score`, plus 1.

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-prisma/SKILL.md` if present (select only needed columns, use indexes, avoid N+1). Reads use the `(status, score)` index for the leaderboard/rank and `(catId, position)` for ordered images. Re-read CLAUDE.md (named exports, `import type`).
- [ ] **Step 2: Write the failing test `src/data/cat-page.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const findUnique = vi.fn();
  const count = vi.fn();
  const findMany = vi.fn();

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      cat: {
        findUnique: (...a: unknown[]) => findUnique(...a),
        count: (...a: unknown[]) => count(...a),
      },
      vote: { findMany: (...a: unknown[]) => findMany(...a) },
    },
  }));
  vi.mock("@/storage/keys", () => ({
    cardUrl: (id: string) => `https://cdn.test/cats/${id}/card.webp`,
  }));

  import { getCatPage } from "@/data/cat-page";

  describe("getCatPage", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns null for a missing or non-ACTIVE cat", async () => {
      findUnique.mockResolvedValue(null);
      expect(await getCatPage("ghost-1")).toBeNull();
    });

    it("maps APPROVED images, computes rank, and lists recent duels", async () => {
      findUnique.mockResolvedValue({
        id: "ca",
        name: "Fluffy",
        slug: "fluffy-1",
        status: "ACTIVE",
        rating: 1600,
        rd: 80,
        wins: 12,
        losses: 4,
        score: 1440,
        images: [
          { id: "img1", width: 800, height: 600, position: 0 },
          { id: "img2", width: 800, height: 600, position: 1 },
        ],
      });
      count.mockResolvedValue(7); // 7 cats above → rank 8
      findMany.mockResolvedValue([
        { id: "v1", winnerCatId: "ca", loserCatId: "cb", createdAt: new Date() },
      ]);

      const page = await getCatPage("fluffy-1");
      expect(page?.name).toBe("Fluffy");
      expect(page?.rank).toBe(8);
      expect(page?.images[0].url).toBe("https://cdn.test/cats/img1/card.webp");
      expect(page?.recentDuels).toHaveLength(1);
      expect(page?.wins).toBe(12);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/data/cat-page.test.ts`
  Expected: FAIL — `Cannot find module '@/data/cat-page'`.
- [ ] **Step 4: Write `src/data/cat-page.ts`**
  ```ts
  import { CatStatus, ImageStatus } from "@prisma/client";

  import { RECENT_DUELS_LIMIT } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";
  import { cardUrl } from "@/storage/keys";

  const RANK_OFFSET = 1;

  export type CatPageImage = {
    url: string;
    width: number;
    height: number;
  };

  export type CatPageDuel = {
    id: string;
    won: boolean;
  };

  export type CatPage = {
    id: string;
    name: string;
    slug: string;
    rating: number;
    rd: number;
    score: number;
    wins: number;
    losses: number;
    rank: number;
    images: CatPageImage[];
    recentDuels: CatPageDuel[];
  };

  /** Load an ACTIVE cat by slug with rank, APPROVED images, and recent duels. */
  export async function getCatPage(slug: string): Promise<CatPage | null> {
    const cat = await prisma.cat.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        rating: true,
        rd: true,
        score: true,
        wins: true,
        losses: true,
        images: {
          where: { status: ImageStatus.APPROVED },
          orderBy: { position: "asc" },
          select: { id: true, width: true, height: true, position: true },
        },
      },
    });

    if (!cat || cat.status !== CatStatus.ACTIVE || cat.images.length === 0) {
      return null;
    }

    const above = await prisma.cat.count({
      where: { status: CatStatus.ACTIVE, score: { gt: cat.score } },
    });

    const votes = await prisma.vote.findMany({
      where: {
        OR: [{ winnerCatId: cat.id }, { loserCatId: cat.id }],
      },
      orderBy: { createdAt: "desc" },
      take: RECENT_DUELS_LIMIT,
      select: { id: true, winnerCatId: true },
    });

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      rating: cat.rating,
      rd: cat.rd,
      score: cat.score,
      wins: cat.wins,
      losses: cat.losses,
      rank: above + RANK_OFFSET,
      images: cat.images.map((img) => ({
        url: cardUrl(img.id),
        width: img.width,
        height: img.height,
      })),
      recentDuels: votes.map((vote) => ({
        id: vote.id,
        won: vote.winnerCatId === cat.id,
      })),
    };
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/data/cat-page.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Write `src/data/leaderboard.ts`**
  ```ts
  import { CatStatus } from "@prisma/client";

  import { TOP_LEADERBOARD_LIMIT } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";
  import { cardUrl } from "@/storage/keys";

  const RANK_OFFSET = 1;

  export type LeaderboardRow = {
    rank: number;
    id: string;
    name: string;
    slug: string;
    score: number;
    rating: number;
    wins: number;
    losses: number;
    thumbUrl: string | null;
  };

  /** Top ACTIVE cats by conservative score, in rank order. */
  export async function getLeaderboard(
    limit = TOP_LEADERBOARD_LIMIT,
  ): Promise<LeaderboardRow[]> {
    const cats = await prisma.cat.findMany({
      where: { status: CatStatus.ACTIVE },
      orderBy: { score: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        slug: true,
        score: true,
        rating: true,
        wins: true,
        losses: true,
        images: {
          where: { status: "APPROVED" },
          orderBy: { position: "asc" },
          take: 1,
          select: { id: true },
        },
      },
    });

    return cats.map((cat, index) => ({
      rank: index + RANK_OFFSET,
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      score: cat.score,
      rating: cat.rating,
      wins: cat.wins,
      losses: cat.losses,
      thumbUrl: cat.images[0] ? cardUrl(cat.images[0].id) : null,
    }));
  }
  ```
- [ ] **Step 7: Write `src/data/indexable.ts`**
  ```ts
  import { CatStatus } from "@prisma/client";

  import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";

  export type IndexableEntry = {
    slug: string;
  };

  /** Slugs of all ACTIVE cats (for the sitemap). PENDING/HIDDEN/BANNED excluded. */
  export async function getIndexableCatSlugs(): Promise<IndexableEntry[]> {
    return prisma.cat.findMany({
      where: { status: CatStatus.ACTIVE },
      orderBy: { score: "desc" },
      select: { slug: true },
    });
  }

  /** Slugs of orgs with >= ORG_MIN_INDEXABLE_MEMBERS members (avoid thin pages). */
  export async function getIndexableOrgSlugs(): Promise<IndexableEntry[]> {
    const orgs = await prisma.organization.findMany({
      select: { slug: true, _count: { select: { members: true } } },
    });
    return orgs
      .filter((org) => org._count.members >= ORG_MIN_INDEXABLE_MEMBERS)
      .map((org) => ({ slug: org.slug }));
  }
  ```
- [ ] **Step 8: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 9: Commit**
  Run: `git add src/data/cat-page.ts src/data/cat-page.test.ts src/data/leaderboard.ts src/data/indexable.ts && git commit -m "feat(data): cat-page, leaderboard, and sitemap indexable loaders"`
  Expected: one commit created.

---

### Task 7: Cat detail body + accessibility (`src/components/cat/cat-detail.tsx`)

**Files:**
- Create: `src/components/cat/cat-detail.tsx`
- Test: `src/components/cat/cat-detail.test.tsx`

- [ ] **Step 1: Load skill web-accessibility-web-accessibility and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-accessibility-web-accessibility/SKILL.md` (landmarks, one `<h1>`, descriptive `alt`, focusable controls). Takeaways applied: the cat name is the single `<h1>`; the gallery is a `<section aria-label>`; every image has descriptive `alt`; stats use a definition list; recent duels are a real list. Also re-read web-testing-react-testing-library for the test and the Task 3 `<CdnImage>`.
- [ ] **Step 2: Write the failing test `src/components/cat/cat-detail.test.tsx`**
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, expect, it } from "vitest";

  import { CatDetail } from "@/components/cat/cat-detail";

  const CAT = {
    id: "ca",
    name: "Fluffy",
    slug: "fluffy-1",
    rating: 1600,
    rd: 80,
    score: 1440,
    wins: 12,
    losses: 4,
    rank: 8,
    images: [
      { url: "https://cdn.test/cats/a/card.webp", width: 800, height: 600 },
      { url: "https://cdn.test/cats/b/card.webp", width: 800, height: 600 },
    ],
    recentDuels: [
      { id: "v1", won: true },
      { id: "v2", won: false },
    ],
  };

  describe("CatDetail", () => {
    it("renders the name as the single h1 with rank and W/L", () => {
      render(<CatDetail cat={CAT} />);
      expect(
        screen.getByRole("heading", { level: 1, name: "Fluffy" }),
      ).toBeInTheDocument();
      expect(screen.getByText(/#8/)).toBeInTheDocument();
      expect(screen.getByText(/12/)).toBeInTheDocument();
      expect(screen.getByText(/4/)).toBeInTheDocument();
    });

    it("gives every gallery image descriptive alt text", () => {
      render(<CatDetail cat={CAT} />);
      const images = screen.getAllByRole("img");
      expect(images).toHaveLength(2);
      for (const img of images) {
        expect(img).toHaveAttribute("alt", expect.stringMatching(/fluffy/i));
      }
    });

    it("lists recent duels", () => {
      render(<CatDetail cat={CAT} />);
      expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/components/cat/cat-detail.test.tsx`
  Expected: FAIL — `Cannot find module '@/components/cat/cat-detail'`.
- [ ] **Step 4: Write the implementation `src/components/cat/cat-detail.tsx`**
  ```tsx
  import { CdnImage } from "@/components/cat/cdn-image";
  import type { CatPage } from "@/data/cat-page";

  const LCP_INDEX = 0;
  const GALLERY_SIZES = "(max-width: 768px) 100vw, 800px";

  type CatDetailProps = {
    cat: CatPage;
  };

  export function CatDetail({ cat }: CatDetailProps) {
    return (
      <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4">
        <header>
          <h1 className="text-3xl font-bold">{cat.name}</h1>
          <p className="text-muted-foreground">
            Место в топе: <span className="font-semibold">#{cat.rank}</span>
          </p>
        </header>

        <section aria-label={`Фотографии котика ${cat.name}`}>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cat.images.map((image, index) => (
              <li key={image.url} className="overflow-hidden rounded-xl">
                <CdnImage
                  src={image.url}
                  alt={`${cat.name} — фото ${index + 1} из ${cat.images.length}`}
                  width={image.width}
                  height={image.height}
                  sizes={GALLERY_SIZES}
                  priority={index === LCP_INDEX}
                  className="h-auto w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Рейтинг">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <dt className="text-sm text-muted-foreground">Рейтинг</dt>
              <dd className="font-semibold">{Math.round(cat.rating)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Счёт</dt>
              <dd className="font-semibold">{Math.round(cat.score)}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Победы</dt>
              <dd className="font-semibold">{cat.wins}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Поражения</dt>
              <dd className="font-semibold">{cat.losses}</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Недавние дуэли">
          <h2 className="mb-2 text-xl font-semibold">Недавние дуэли</h2>
          {cat.recentDuels.length === 0 ? (
            <p className="text-muted-foreground">Пока нет дуэлей.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {cat.recentDuels.map((duel) => (
                <li key={duel.id}>{duel.won ? "Победа" : "Поражение"}</li>
              ))}
            </ul>
          )}
        </section>
      </article>
    );
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/components/cat/cat-detail.test.tsx`
  Expected: PASS — 3 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/components/cat/cat-detail.tsx src/components/cat/cat-detail.test.tsx && git commit -m "feat(cat): accessible cat-detail body (h1, gallery alts, stats, recent duels)"`
  Expected: one commit created.

---

### Task 8: `/cat/[slug]` ISR page + metadata + JSON-LD + not-found

**Files:**
- Create: `src/app/cat/[slug]/page.tsx`
- Create: `src/app/cat/[slug]/not-found.tsx`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — (already loaded.) ISR via `export const revalidate`; `generateStaticParams` pre-renders known cats; `generateMetadata` sets title/description, canonical, OG/Twitter; `params` is a Promise (await it); `notFound()` for non-ACTIVE cats. OG image is auto-discovered from the colocated `opengraph-image.tsx` (Task 9) — do NOT also hand-set `openGraph.images` here.
- [ ] **Step 2: Write the not-found UI `src/app/cat/[slug]/not-found.tsx`**
  ```tsx
  import Link from "next/link";

  export default function CatNotFound() {
    return (
      <main className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-2xl font-bold">Котик не найден</h1>
        <p className="mt-2 text-muted-foreground">
          Возможно, он ещё на модерации или был скрыт.
        </p>
        <Link href="/top" className="mt-4 inline-block underline">
          Смотреть топ котиков
        </Link>
      </main>
    );
  }
  ```
- [ ] **Step 3: Write the page `src/app/cat/[slug]/page.tsx`**
  ```tsx
  import type { Metadata } from "next";
  import { notFound } from "next/navigation";

  import { CatDetail } from "@/components/cat/cat-detail";
  import { JsonLd } from "@/components/seo/json-ld";
  import {
    ISR_REVALIDATE_SECONDS,
    SITE_NAME,
    TOP_LEADERBOARD_LIMIT,
  } from "@/lib/constants";
  import { catJsonLd } from "@/lib/seo";
  import { absoluteUrl, catPath } from "@/lib/site";
  import { getCatPage } from "@/data/cat-page";
  import { getIndexableCatSlugs } from "@/data/indexable";

  export const revalidate = ISR_REVALIDATE_SECONDS;
  export const dynamicParams = true;

  type PageProps = {
    params: Promise<{ slug: string }>;
  };

  export async function generateStaticParams(): Promise<{ slug: string }[]> {
    const slugs = await getIndexableCatSlugs();
    return slugs.slice(0, TOP_LEADERBOARD_LIMIT).map(({ slug }) => ({ slug }));
  }

  export async function generateMetadata({
    params,
  }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const cat = await getCatPage(slug);
    if (!cat) {
      return { title: "Котик не найден", robots: { index: false } };
    }
    const description = `${cat.name} — место #${cat.rank} в рейтинге котиков. Рейтинг ${Math.round(cat.rating)}, ${cat.wins} побед / ${cat.losses} поражений.`;
    return {
      title: cat.name,
      description,
      alternates: { canonical: absoluteUrl(catPath(cat.slug)) },
      openGraph: {
        title: `${cat.name} | ${SITE_NAME}`,
        description,
        url: absoluteUrl(catPath(cat.slug)),
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `${cat.name} | ${SITE_NAME}`,
        description,
      },
    };
  }

  export default async function CatPage({ params }: PageProps) {
    const { slug } = await params;
    const cat = await getCatPage(slug);
    if (!cat) {
      notFound();
    }

    return (
      <main>
        <JsonLd
          data={catJsonLd({
            name: cat.name,
            slug: cat.slug,
            images: cat.images,
          })}
        />
        <CatDetail cat={cat} />
      </main>
    );
  }
  ```
- [ ] **Step 4: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 5: Build the route to prove ISR/metadata compile**
  Run: `npm run build`
  Expected: build succeeds; output lists `/cat/[slug]` as a dynamic route with `Revalidate` set. (If the build needs a DB at collection time and none is available locally, it is acceptable for `generateStaticParams` to return `[]` — `dynamicParams = true` renders on demand; the route must still compile.)
- [ ] **Step 6: Commit**
  Run: `git add src/app/cat/[slug]/page.tsx src/app/cat/[slug]/not-found.tsx && git commit -m "feat(seo): /cat/[slug] ISR page with metadata, canonical, and JSON-LD"`
  Expected: one commit created.

---

### Task 9: Dynamic OG image for a cat (`next/og`)

**Files:**
- Create: `src/app/cat/[slug]/opengraph-image.tsx`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — (already loaded.) `opengraph-image.tsx` exports `size`, `contentType`, and a default async function returning `ImageResponse` from `next/og`. It runs on the edge; it must NOT import the Prisma client (no edge DB). It reads the cat name/top image via a public fetch or a lightweight loader — here we reuse `getCatPage` only if it is Node-safe; to stay edge-safe we fetch the cat name from our own `/cat/[slug]` is overkill, so we render the name from a minimal server query guarded to the nodejs runtime.
- [ ] **Step 2: Write the OG image route `src/app/cat/[slug]/opengraph-image.tsx`**
  Pin to the Node runtime so it can reuse `getCatPage` (Prisma). The card composites the cat name, rank, and its `card` image (served from the CDN).
  ```tsx
  import { ImageResponse } from "next/og";

  import { OG_SIZE, SITE_NAME } from "@/lib/constants";
  import { getCatPage } from "@/data/cat-page";

  export const runtime = "nodejs";
  export const size = OG_SIZE;
  export const contentType = "image/png";

  export const alt = "Cat Arena — карточка котика";

  type OgProps = {
    params: { slug: string };
  };

  export default async function CatOgImage({ params }: OgProps) {
    const cat = await getCatPage(params.slug);
    const name = cat?.name ?? SITE_NAME;
    const rank = cat ? `#${cat.rank}` : "";
    const imageUrl = cat?.images[0]?.url;

    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#0b0b0f",
          color: "#ffffff",
        }}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            width={OG_SIZE.height}
            height={OG_SIZE.height}
            style={{ objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: 64,
            flex: 1,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 700 }}>{name}</div>
          {rank ? (
            <div style={{ fontSize: 40, opacity: 0.8 }}>
              Место в топе {rank}
            </div>
          ) : null}
          <div style={{ fontSize: 32, opacity: 0.6, marginTop: 24 }}>
            {SITE_NAME}
          </div>
        </div>
      </div>,
      { ...OG_SIZE },
    );
  }
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors. (`next/og` types ship with Next.js 15.)
- [ ] **Step 4: Commit**
  Run: `git add src/app/cat/[slug]/opengraph-image.tsx && git commit -m "feat(seo): dynamic OG image for /cat/[slug] via next/og ImageResponse"`
  Expected: one commit created.

---

### Task 10: `/top` leaderboard ISR page + ItemList JSON-LD

**Files:**
- Create: `src/app/top/page.tsx`

- [ ] **Step 1: Load skill web-accessibility-web-accessibility and follow its best practices** — (already loaded in Task 7.) The leaderboard is a real `<table>` with `<caption>` and `<th scope>`; the page has one `<h1>`. Re-read web-meta-framework-nextjs for ISR + metadata and web-performance (thumbnails are lazy `<CdnImage>` with width/height).
- [ ] **Step 2: Write the page `src/app/top/page.tsx`**
  ```tsx
  import type { Metadata } from "next";
  import Link from "next/link";

  import { CdnImage } from "@/components/cat/cdn-image";
  import { JsonLd } from "@/components/seo/json-ld";
  import { ISR_REVALIDATE_SECONDS, SITE_NAME } from "@/lib/constants";
  import { leaderboardJsonLd } from "@/lib/seo";
  import { absoluteUrl } from "@/lib/site";
  import { catPath } from "@/lib/site";
  import { getLeaderboard } from "@/data/leaderboard";

  export const revalidate = ISR_REVALIDATE_SECONDS;

  const TOP_DESCRIPTION =
    "Лучшие котики по рейтингу Glicko-2 (нижняя граница 95% доверительного интервала).";
  const THUMB_PX = 64;

  export const metadata: Metadata = {
    title: "Топ котиков",
    description: TOP_DESCRIPTION,
    alternates: { canonical: absoluteUrl("/top") },
    openGraph: {
      title: `Топ котиков | ${SITE_NAME}`,
      description: TOP_DESCRIPTION,
      url: absoluteUrl("/top"),
      type: "website",
    },
    twitter: { card: "summary_large_image", title: `Топ котиков | ${SITE_NAME}` },
  };

  export default async function TopPage() {
    const rows = await getLeaderboard();

    return (
      <main className="mx-auto w-full max-w-3xl p-4">
        <JsonLd
          data={leaderboardJsonLd(
            rows.map((row) => ({ name: row.name, slug: row.slug })),
          )}
        />
        <h1 className="mb-4 text-3xl font-bold">Топ котиков</h1>
        <table className="w-full border-collapse">
          <caption className="sr-only">{TOP_DESCRIPTION}</caption>
          <thead>
            <tr>
              <th scope="col" className="text-left">#</th>
              <th scope="col" className="text-left">Котик</th>
              <th scope="col" className="text-right">Счёт</th>
              <th scope="col" className="text-right">П/П</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.rank}</td>
                <td>
                  <Link
                    href={catPath(row.slug)}
                    className="flex items-center gap-2 underline"
                  >
                    {row.thumbUrl ? (
                      <CdnImage
                        src={row.thumbUrl}
                        alt={row.name}
                        width={THUMB_PX}
                        height={THUMB_PX}
                        className="rounded"
                      />
                    ) : null}
                    {row.name}
                  </Link>
                </td>
                <td className="text-right">{Math.round(row.score)}</td>
                <td className="text-right">
                  {row.wins}/{row.losses}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    );
  }
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 4: Commit**
  Run: `git add src/app/top/page.tsx && git commit -m "feat(seo): /top ISR leaderboard with accessible table and ItemList JSON-LD"`
  Expected: one commit created.

---

### Task 11: Dynamic `sitemap.ts` + `robots.ts`

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — (already loaded.) Use the typed `MetadataRoute.Sitemap` / `MetadataRoute.Robots` returns; `sitemap.ts` queries indexable loaders (Task 6) and emits absolute URLs; `robots.ts` allows crawl, disallows `/api`, `/admin`, `/upload`, and points at the sitemap. Both honor `ISR_REVALIDATE_SECONDS` so they are regenerated periodically.
- [ ] **Step 2: Write `src/app/sitemap.ts`**
  ```ts
  import type { MetadataRoute } from "next";

  import { ISR_REVALIDATE_SECONDS } from "@/lib/constants";
  import { absoluteUrl, catPath, orgPath } from "@/lib/site";
  import { getIndexableCatSlugs, getIndexableOrgSlugs } from "@/data/indexable";

  export const revalidate = ISR_REVALIDATE_SECONDS;

  export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [cats, orgs] = await Promise.all([
      getIndexableCatSlugs(),
      getIndexableOrgSlugs(),
    ]);

    const lastModified = new Date();

    const staticEntries: MetadataRoute.Sitemap = [
      { url: absoluteUrl("/"), lastModified, priority: 1 },
      { url: absoluteUrl("/top"), lastModified, priority: 0.8 },
    ];

    const catEntries: MetadataRoute.Sitemap = cats.map(({ slug }) => ({
      url: absoluteUrl(catPath(slug)),
      lastModified,
      priority: 0.6,
    }));

    const orgEntries: MetadataRoute.Sitemap = orgs.map(({ slug }) => ({
      url: absoluteUrl(orgPath(slug)),
      lastModified,
      priority: 0.5,
    }));

    return [...staticEntries, ...catEntries, ...orgEntries];
  }
  ```
- [ ] **Step 3: Write `src/app/robots.ts`**
  ```ts
  import type { MetadataRoute } from "next";

  import { absoluteUrl } from "@/lib/site";

  export default function robots(): MetadataRoute.Robots {
    return {
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/upload"],
      },
      sitemap: absoluteUrl("/sitemap.xml"),
    };
  }
  ```
- [ ] **Step 4: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 5: Commit**
  Run: `git add src/app/sitemap.ts src/app/robots.ts && git commit -m "feat(seo): dynamic sitemap (APPROVED cats + qualifying orgs) and robots"`
  Expected: one commit created.

---

### Task 12: PostHog provider + analytics layer + wire vote-funnel events

**Files:**
- Create: `src/lib/analytics.ts`
- Create: `src/components/providers/posthog-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/hooks/use-next-pair.ts`
- Modify: `src/hooks/use-submit-vote.ts`
- Modify: `src/components/duel/skip-button.tsx`
- Test: `src/lib/analytics.test.ts`

- [ ] **Step 1: Load skills api-analytics-setup-posthog and api-analytics-posthog-analytics and follow their best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-analytics-setup-posthog/SKILL.md` (+ `examples/core.md`) and `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-analytics-posthog-analytics/SKILL.md`. Takeaways applied: init `posthog-js` only in the browser (provider), `defaults: "2026-01-30"`, `person_profiles: "identified_only"`, env keys `NEXT_PUBLIC_POSTHOG_KEY`/`NEXT_PUBLIC_POSTHOG_HOST` (contracts §5), `category:object_action` event names from constants, and NEVER put PII (no cat names/emails) in properties — only ids and counts.
- [ ] **Step 2: Install PostHog**
  Run: `npm i posthog-js`
  Expected: `posthog-js` added to `dependencies`.
- [ ] **Step 3: Write the failing test `src/lib/analytics.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const capture = vi.fn();
  vi.mock("posthog-js", () => ({
    default: { capture: (...a: unknown[]) => capture(...a) },
  }));

  import { ANALYTICS_EVENT } from "@/lib/constants";
  import { captureEvent } from "@/lib/analytics";

  describe("captureEvent", () => {
    beforeEach(() => vi.clearAllMocks());

    it("forwards the event name and properties to posthog", () => {
      captureEvent(ANALYTICS_EVENT.VOTE_CAST, { winner_cat_id: "ca" });
      expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENT.VOTE_CAST, {
        winner_cat_id: "ca",
      });
    });

    it("captures with no properties", () => {
      captureEvent(ANALYTICS_EVENT.SKIP);
      expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENT.SKIP, undefined);
    });
  });
  ```
- [ ] **Step 4: Run the test and confirm it FAILS**
  Run: `npx vitest run src/lib/analytics.test.ts`
  Expected: FAIL — `Cannot find module '@/lib/analytics'`.
- [ ] **Step 5: Write `src/lib/analytics.ts`**
  ```ts
  "use client";

  import posthog from "posthog-js";

  import { ANALYTICS_EVENT } from "@/lib/constants";

  export type AnalyticsEvent =
    (typeof ANALYTICS_EVENT)[keyof typeof ANALYTICS_EVENT];

  /**
   * Capture a product event. No PII — pass ids and counts only.
   * Safe to call before init: posthog-js queues until loaded.
   */
  export function captureEvent(
    event: AnalyticsEvent,
    properties?: Record<string, string | number | boolean>,
  ): void {
    posthog.capture(event, properties);
  }
  ```
- [ ] **Step 6: Run the test and confirm it PASSES**
  Run: `npx vitest run src/lib/analytics.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 7: Write the provider `src/components/providers/posthog-provider.tsx`**
  ```tsx
  "use client";

  import posthog from "posthog-js";
  import { PostHogProvider as PHProvider } from "posthog-js/react";
  import { useEffect } from "react";

  const POSTHOG_DEFAULTS_VERSION = "2026-01-30";

  type PostHogProviderProps = {
    children: React.ReactNode;
  };

  export function PostHogProvider({ children }: PostHogProviderProps) {
    useEffect(() => {
      const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
      const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
      if (!key || typeof window === "undefined" || posthog.__loaded) {
        return;
      }
      posthog.init(key, {
        api_host: host,
        defaults: POSTHOG_DEFAULTS_VERSION,
        person_profiles: "identified_only",
        loaded: (ph) => {
          if (process.env.NODE_ENV === "development") {
            ph.debug();
          }
        },
      });
    }, []);

    return <PHProvider client={posthog}>{children}</PHProvider>;
  }
  ```
- [ ] **Step 8: Wrap the root layout** — open `src/app/layout.tsx`. Add the import (ordered internal):
  ```tsx
  import { PostHogProvider } from "@/components/providers/posthog-provider";
  ```
  Wrap the existing provider tree so PostHog is outermost inside `<body>`: change the existing `<MotionConfig ...><QueryProvider>{children}</QueryProvider></MotionConfig>` to:
  ```tsx
  <PostHogProvider>
    <MotionConfig reducedMotion="user">
      <QueryProvider>{children}</QueryProvider>
    </MotionConfig>
  </PostHogProvider>
  ```
- [ ] **Step 9: Emit `pair_served` in `src/hooks/use-next-pair.ts`** — add the import and fire the event when a pair resolves. Add at the top (internal imports, ordered):
  ```ts
  import { useEffect } from "react";

  import { captureEvent } from "@/lib/analytics";
  import { ANALYTICS_EVENT } from "@/lib/constants";
  ```
  Inside `useNextPair`, after the `useQuery(...)` call and before the `return`, add:
  ```ts
  useEffect(() => {
    if (query.data) {
      captureEvent(ANALYTICS_EVENT.PAIR_SERVED, {
        a_cat_id: query.data.a.id,
        b_cat_id: query.data.b.id,
        scope,
      });
    }
  }, [query.data, scope]);
  ```
- [ ] **Step 10: Emit `vote_cast` in `src/hooks/use-submit-vote.ts`** — add imports:
  ```ts
  import { captureEvent } from "@/lib/analytics";
  import { ANALYTICS_EVENT } from "@/lib/constants";
  ```
  In the `useMutation({...})` options, add an `onSuccess` that fires the event (keep the existing `onSettled` invalidation):
  ```ts
  onSuccess: (data) =>
    captureEvent(ANALYTICS_EVENT.VOTE_CAST, {
      winner_cat_id: data.winner.id,
      loser_cat_id: data.loser.id,
    }),
  ```
- [ ] **Step 11: Emit `skip` in `src/components/duel/skip-button.tsx`** — add imports:
  ```ts
  import { captureEvent } from "@/lib/analytics";
  import { ANALYTICS_EVENT } from "@/lib/constants";
  ```
  Change the button `onClick` so it captures then skips:
  ```tsx
  onClick={() => {
    captureEvent(ANALYTICS_EVENT.SKIP);
    onSkip();
  }}
  ```
- [ ] **Step 12: Run the affected suites + typecheck**
  Run: `npx vitest run src/lib/analytics.test.ts src/components/duel/skip-button.test.tsx && npx tsc --noEmit`
  Expected: PASS for analytics; if `skip-button` has no test file the vitest filter simply runs the analytics suite — that is fine. `tsc` reports no errors. (If the phase-04 `skip-button.test.tsx` asserts `onSkip` is called on click, it still passes because `onSkip` is still invoked.)
- [ ] **Step 13: Commit**
  Run: `git add src/lib/analytics.ts src/lib/analytics.test.ts src/components/providers/posthog-provider.tsx src/app/layout.tsx src/hooks/use-next-pair.ts src/hooks/use-submit-vote.ts src/components/duel/skip-button.tsx package.json package-lock.json && git commit -m "feat(analytics): PostHog provider + vote-funnel events (pair_served, vote_cast, skip)"`
  Expected: one commit created.

---

### Task 13: Sentry error + performance monitoring

**Files:**
- Create: `sentry.client.config.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `instrumentation.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Load skill api-observability-setup-axiom-pino-sentry and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-observability-setup-axiom-pino-sentry/SKILL.md` (+ `examples/sentry-config.md`, `examples/core.md`). Takeaways applied: three runtime configs, named sample-rate constants (no magic numbers), v9 API (no `enableTracing`/`hideSourceMaps`), `instrumentation.ts` with dynamic imports + `onRequestError`, wrap `next.config.ts` with `withSentryConfig`. Scope: Sentry only (Axiom/Pino are out of scope for this phase). Contracts §5 names the secret `SENTRY_DSN`; the SDK reads `NEXT_PUBLIC_SENTRY_DSN` on the client, so set both to the same value in env (documented below).
- [ ] **Step 2: Install Sentry**
  Run: `npm i @sentry/nextjs`
  Expected: `@sentry/nextjs` added to `dependencies`.
- [ ] **Step 3: Write `sentry.client.config.ts`**
  ```ts
  import * as Sentry from "@sentry/nextjs";

  const SENTRY_DSN =
    process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  const TRACES_SAMPLE_RATE = 0.2;
  const REPLAY_SESSION_SAMPLE_RATE = 0.1;
  const REPLAY_ON_ERROR_SAMPLE_RATE = 1.0;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    replaysSessionSampleRate: REPLAY_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: REPLAY_ON_ERROR_SAMPLE_RATE,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    debug: process.env.NODE_ENV === "development",
  });
  ```
- [ ] **Step 4: Write `sentry.server.config.ts`**
  ```ts
  import * as Sentry from "@sentry/nextjs";

  const SENTRY_DSN =
    process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  const TRACES_SAMPLE_RATE = 0.2;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    debug: process.env.NODE_ENV === "development",
  });
  ```
- [ ] **Step 5: Write `sentry.edge.config.ts`**
  ```ts
  import * as Sentry from "@sentry/nextjs";

  const SENTRY_DSN =
    process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN;
  const TRACES_SAMPLE_RATE = 0.2;

  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    debug: false,
  });
  ```
- [ ] **Step 6: Write `instrumentation.ts`** (at repo root)
  ```ts
  import * as Sentry from "@sentry/nextjs";

  export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
      await import("./sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
      await import("./sentry.edge.config");
    }
  }

  export const onRequestError = Sentry.captureRequestError;
  ```
- [ ] **Step 7: Wrap `next.config.ts` with `withSentryConfig`** — open `next.config.ts`. It currently exports a config that ALSO carries the custom image loader from Task 14 (if Task 14 ran first) — preserve whatever `nextConfig` already contains. Wrap the export:
  ```ts
  import { withSentryConfig } from "@sentry/nextjs";

  // ... existing `const nextConfig = { ... }` (image loader etc.) stays as-is ...

  export default withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: !process.env.CI,
  });
  ```
  If `next.config.ts` had `export default nextConfig`, replace that single line with the wrapped export above. Add the import at the top.
- [ ] **Step 8: Typecheck + build**
  Run: `npx tsc --noEmit && npm run build`
  Expected: no type errors; build succeeds. Source-map upload is skipped locally because `SENTRY_AUTH_TOKEN` is unset (`silent: !CI` suppresses the notice).
- [ ] **Step 9: Commit**
  Run: `git add sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts instrumentation.ts next.config.ts package.json package-lock.json && git commit -m "feat(observability): Sentry client/server/edge configs + instrumentation + next.config wrap"`
  Expected: one commit created.

---

### Task 14: Custom image loader in `next.config.ts`

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Load skill web-performance-web-performance and follow its best practices** — (already loaded in Task 3.) Configuring `images.loader: "custom"` + `images.loaderFile` makes EVERY `next/image` use our CDN loader, so no request ever hits Vercel's optimizer (preserving the free quota under a viral spike). The loader file must default-export a function with the `({ src, width, quality })` signature.
- [ ] **Step 2: Create the loader-file shim `src/lib/next-image-loader.ts`**
  Next.js requires `loaderFile` to have a DEFAULT export, but the project bans default exports outside framework files. This file is a framework-required loader file (same exemption class as `page`/`route`), so a default export is allowed here. It re-exports the tested named loader from Task 3.
  ```ts
  import { catImageLoader } from "@/lib/cat-image-loader";

  export default function loader(props: {
    src: string;
    width: number;
    quality?: number;
  }): string {
    return catImageLoader(props);
  }
  ```
- [ ] **Step 3: Add the image config to `next.config.ts`** — open `next.config.ts` and add an `images` block to the existing `nextConfig` object (do not remove the Sentry wrap from Task 13 if present):
  ```ts
  const nextConfig = {
    // ...any existing options...
    images: {
      loader: "custom" as const,
      loaderFile: "./src/lib/next-image-loader.ts",
    },
  };
  ```
- [ ] **Step 4: Typecheck + build**
  Run: `npx tsc --noEmit && npm run build`
  Expected: no errors; build output confirms images use a custom loader (no Vercel optimizer entries). Add this note as a comment above the `images` block in `next.config.ts`: `// Custom loader → R2/CDN; bypasses Vercel image optimization quota.`
- [ ] **Step 5: Commit**
  Run: `git add next.config.ts src/lib/next-image-loader.ts && git commit -m "feat(perf): configure custom next/image loader (CDN-direct, no Vercel optimization)"`
  Expected: one commit created.

---

### Task 15: E2E — cat page metadata + JSON-LD parses

**Files:**
- Create: `e2e/cat-page.spec.ts`

The DB is seeded for e2e by the scaffold/data phases. To keep this spec deterministic and independent of seed contents, it discovers a real cat slug from the sitemap, then asserts on that page. The assertions are structural (title pattern, canonical present, JSON-LD `@type`), not value-specific.

- [ ] **Step 1: Load skill web-testing-playwright-e2e and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-playwright-e2e/SKILL.md` (named constants, `page.goto`, web-first assertions, read DOM via `page.locator`/`page.title()`). No manual sleeps. `playwright.config.ts` (`webServer` → `npm run dev`) is assumed from scaffold.
- [ ] **Step 2: Write the spec `e2e/cat-page.spec.ts`**
  ```ts
  import { expect, test } from "@playwright/test";

  const SITEMAP_URL = "/sitemap.xml";
  const CAT_URL_RE = /\/cat\/[^<]+/;

  async function firstCatPath(baseURL: string): Promise<string | null> {
    const res = await fetch(new URL(SITEMAP_URL, baseURL));
    const xml = await res.text();
    const match = xml.match(CAT_URL_RE);
    if (!match) {
      return null;
    }
    return new URL(match[0]).pathname;
  }

  test.describe("Cat page SEO", () => {
    test("exposes title, canonical, and ImageGallery JSON-LD", async ({
      page,
      baseURL,
    }) => {
      test.skip(!baseURL, "baseURL required");
      const path = await firstCatPath(baseURL as string);
      test.skip(!path, "no APPROVED cat in sitemap to test");

      await page.goto(path as string);

      // Title uses the "%s | Cat Arena" template from the root layout.
      await expect(page).toHaveTitle(/\| Cat Arena$/);

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);

      const ldText = await page
        .locator('script[type="application/ld+json"]')
        .first()
        .textContent();
      expect(ldText).toBeTruthy();
      const ld = JSON.parse(ldText as string);
      const graph = ld["@graph"] as Array<Record<string, unknown>>;
      const types = graph.map((node) => node["@type"]);
      expect(types).toContain("ImageGallery");
      expect(types).toContain("BreadcrumbList");
    });
  });
  ```
- [ ] **Step 3: Run the spec**
  Run: `npx playwright test e2e/cat-page.spec.ts`
  Expected: PASS — 1 passing (or skipped if the seed has no APPROVED cat; in CI with seed data it passes). First run may need `npx playwright install`.
- [ ] **Step 4: Commit**
  Run: `git add e2e/cat-page.spec.ts && git commit -m "test(e2e): cat page exposes title, canonical, and ImageGallery JSON-LD"`
  Expected: one commit created.

---

### Task 16: E2E — `/top` metadata + ItemList JSON-LD

**Files:**
- Create: `e2e/top.spec.ts`

- [ ] **Step 1: Load skill web-testing-playwright-e2e and follow its best practices** — (already loaded.) Structural assertions only (title, canonical, JSON-LD `@type === "ItemList"`).
- [ ] **Step 2: Write the spec `e2e/top.spec.ts`**
  ```ts
  import { expect, test } from "@playwright/test";

  const TOP_URL = "/top";

  test.describe("Leaderboard SEO", () => {
    test("exposes title and ItemList JSON-LD", async ({ page }) => {
      await page.goto(TOP_URL);

      await expect(page).toHaveTitle(/Топ котиков \| Cat Arena$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Топ котиков" }),
      ).toBeVisible();

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);

      const ldText = await page
        .locator('script[type="application/ld+json"]')
        .first()
        .textContent();
      const ld = JSON.parse(ldText as string);
      expect(ld["@type"]).toBe("ItemList");
    });
  });
  ```
- [ ] **Step 3: Run the spec**
  Run: `npx playwright test e2e/top.spec.ts`
  Expected: PASS — 1 passing.
- [ ] **Step 4: Commit**
  Run: `git add e2e/top.spec.ts && git commit -m "test(e2e): /top exposes title, canonical, and ItemList JSON-LD"`
  Expected: one commit created.

---

### Task 17: E2E — sitemap includes APPROVED, excludes PENDING

**Files:**
- Create: `e2e/sitemap.spec.ts`

This spec verifies the sitemap inclusion/exclusion contract directly against the route. It relies on the e2e seed providing at least one ACTIVE cat and one PENDING cat (created by the data/upload phases' seed). If the seed exposes fixed slugs, prefer asserting those exact slugs; the spec below asserts the general invariant (every `/cat/...` URL in the sitemap resolves to a 200 ACTIVE page, and a known PENDING slug is absent).

- [ ] **Step 1: Load skill web-testing-playwright-e2e and follow its best practices** — (already loaded.) Fetch the raw `sitemap.xml`, assert URL membership. Use named constants for the seeded slugs.
- [ ] **Step 2: Write the spec `e2e/sitemap.spec.ts`**
  ```ts
  import { expect, test } from "@playwright/test";

  const SITEMAP_URL = "/sitemap.xml";
  // Seeded by the data/upload phases. Adjust to match the e2e seed if different.
  const APPROVED_CAT_SLUG = "seed-approved-cat";
  const PENDING_CAT_SLUG = "seed-pending-cat";

  test.describe("Sitemap inclusion", () => {
    test("includes an APPROVED cat and excludes a PENDING cat", async ({
      baseURL,
    }) => {
      test.skip(!baseURL, "baseURL required");
      const res = await fetch(new URL(SITEMAP_URL, baseURL as string));
      expect(res.status).toBe(200);
      const xml = await res.text();

      expect(xml).toContain(`/cat/${APPROVED_CAT_SLUG}`);
      expect(xml).not.toContain(`/cat/${PENDING_CAT_SLUG}`);
      // Static surfaces always present.
      expect(xml).toContain("/top");
    });
  });
  ```
- [ ] **Step 3: Run the spec**
  Run: `npx playwright test e2e/sitemap.spec.ts`
  Expected: PASS — 1 passing. (If the e2e seed uses different slugs, update the two constants to match the seed; the assertion logic — APPROVED present, PENDING absent — is the contract under test.)
- [ ] **Step 4: Commit**
  Run: `git add e2e/sitemap.spec.ts && git commit -m "test(e2e): sitemap includes APPROVED cat, excludes PENDING cat"`
  Expected: one commit created.

---

### Task 18: Full-phase verification (tests, lint, build, a11y/CWV pass)

**Files:**
- (no new files — verification only)

- [ ] **Step 1: Load skill superpowers:verification-before-completion and follow its best practices** — gather evidence before claiming the phase is done; run every command and read its output.
- [ ] **Step 2: Run the full unit/component suite**
  Run: `npx vitest run`
  Expected: PASS — all suites green, including `site`, `seo`, `cat-image-loader`, `cat-page`, `cat-detail`, `analytics`, plus all phase 01-07 suites.
- [ ] **Step 3: Run the SEO e2e specs**
  Run: `npx playwright test e2e/cat-page.spec.ts e2e/top.spec.ts e2e/sitemap.spec.ts`
  Expected: PASS — 3 passing (cat-page/sitemap may skip if seed lacks the fixtures; `/top` always passes).
- [ ] **Step 4: Production build (proves ISR routes, OG image, sitemap, robots compile)**
  Run: `npm run build`
  Expected: build succeeds; route list shows `/cat/[slug]` (ISR + opengraph-image), `/top` (ISR), `/sitemap.xml`, `/robots.txt`.
- [ ] **Step 5: Lint, CSS-lint, typecheck**
  Run: `npm run lint && npm run lint:css && npx tsc --noEmit`
  Expected: no errors from Biome, Stylelint, or tsc.
- [ ] **Step 6: Accessibility + Core Web Vitals manual checklist** — load skill web-accessibility-web-accessibility and confirm against the running build (`npm run start`): (a) `/cat/[slug]` and `/top` each have exactly one `<h1>`; (b) every `<img>` has non-empty `alt`; (c) main content is inside a `<main>` landmark; (d) all interactive controls (carousel arrows, vote/skip, links) are keyboard-focusable with visible focus; (e) Lighthouse on `/cat/[slug]` shows CLS = 0 (explicit width/height) and images served from the CDN host (not `/_next/image`). Record findings; fix any failures by adjusting `alt`/landmarks/`width`/`height` (no new files expected).
- [ ] **Step 7: Final lint/format commit (only if auto-fixes applied)**
  Run: `git add -A && git commit -m "chore(seo): lint/format and a11y/CWV pass for SEO & analytics phase"`
  Expected: a commit only if Biome/Stylelint changed files; otherwise nothing to commit.
