# Organizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Ship org-scoped rating: authenticated users create an Organization (unique name, optional logo + description, generated long join code), cat owners join/leave their cats to orgs by code, and each org gets a member-only voting feed plus a leaderboard sorted by the local `CatOrg.score`.
**Architecture:** Thin Next.js Route Handlers validate every external input with Zod at the boundary and delegate to single-responsibility modules in `src/org` (`create-org`, `join-by-code`, `leave-org`, `join-code`). All caps are enforced both at the DB level (`Organization.createdById @unique` = `MAX_ORGS_PER_USER`) and in application code (`MAX_ORGS_PER_CAT` counts `CatOrg` rows before insert). Org-scoped pairing reuses the phase-03 `pickPair({ scope: { orgId } })`; org-scoped voting reuses the phase-04 `POST /api/vote`, which already updates every `CatOrg` row in the winner∩loser org intersection inside its `$transaction`. The `/orgs/new` page is RHF + Zod; `/org/[slug]` is an RSC shell mounting a client `OrgFeed` (TanStack Query duel) and a server-rendered `OrgLeaderboard`.
**Tech Stack:** Next.js 15 App Router (Route Handlers + RSC), Prisma + Neon Postgres, Zod v4, React Hook Form + `@hookform/resolvers/zod`, TanStack Query v5, Cloudflare R2 (logo upload via the phase-06 presign flow), shadcn/ui + CVA, Vitest + React Testing Library, Playwright.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/constants.ts` | Add `ORG_MIN_INDEXABLE_MEMBERS`, `ORG_JOIN_CODE_LENGTH`, `ORG_NAME_MIN/MAX`, `ORG_DESCRIPTION_MAX` named constants to the existing constants module |
| `src/org/join-code.ts` | `generateJoinCode()` — long URL-safe random invite code (length from constants) |
| `src/org/join-code.test.ts` | Vitest: length, alphabet, uniqueness across many draws |
| `src/org/create-org.ts` | `createOrg({ userId, name, description?, logoR2Key? })` — enforce `MAX_ORGS_PER_USER`, generate unique `joinCode` + `slug`, create `Organization` |
| `src/org/create-org.test.ts` | Vitest (prisma mocked): success shape, name-unique 409, already-owns-org 409 |
| `src/org/join-by-code.ts` | `joinByCode({ catId, joinCode })` — resolve code, enforce `MAX_ORGS_PER_CAT`, create `CatOrg` with Glicko defaults |
| `src/org/join-by-code.test.ts` | Vitest (prisma mocked): invalid code, cap reached, already-member, success |
| `src/org/leave-org.ts` | `leaveOrg({ catId, orgId })` — delete the `CatOrg` membership row |
| `src/org/leave-org.test.ts` | Vitest (prisma mocked): membership-not-found, success |
| `src/app/api/orgs/route.ts` | `POST /api/orgs` — auth-gated, Zod body, calls `createOrg`, maps errors to 409/422/500 |
| `src/app/api/orgs/route.test.ts` | Vitest: 401, 400, 201 shape, 409 duplicate |
| `src/app/api/cats/[id]/orgs/route.ts` | `POST` (join) + `DELETE` (leave) `/api/cats/[id]/orgs` — auth + cat-owner check, Zod body |
| `src/app/api/cats/[id]/orgs/route.test.ts` | Vitest: 403 not owner, 422 invalid code, 409 cap, 200 join, 200/404 leave |
| `src/lib/org-api-types.ts` | Shared response/error types for the org endpoints, consumed by the form + feed |
| `src/components/org/org-create-form.tsx` | RHF + Zod create-org form (name, optional description, optional logo upload) |
| `src/components/org/org-create-form.test.tsx` | RTL: client-side required-name validation, successful submit posts and redirects |
| `src/components/org/org-feed.tsx` | Client org-scoped duel: `<DuelArena scope={orgId} />` wrapper with member-only gate |
| `src/components/org/org-leaderboard.tsx` | Server-rendered table of `CatOrg` rows sorted by `score` desc |
| `src/components/org/org-leaderboard.test.tsx` | RTL: renders rows in score order, shows rank/name/score |
| `src/app/orgs/new/page.tsx` | `/orgs/new` — `requireUser`-gated RSC shell mounting `OrgCreateForm` |
| `src/app/org/[slug]/page.tsx` | `/org/[slug]` — RSC: load org + members, `generateMetadata` (noindex if < `ORG_MIN_INDEXABLE_MEMBERS`), render feed + leaderboard |
| `e2e/org.spec.ts` | Playwright: create org, join a cat by code, see member-only feed + leaderboard |

> Assumes phases 01–06 are done: `src/lib/prisma.ts` (`prisma` singleton + `$transaction`), `src/lib/constants.ts` (§4 base constants), `src/lib/slug.ts` (`slug(name): string`), `src/lib/r2.ts` (`publicUrl(key): string`), `src/auth` (`auth()` and `requireUser()` returning a `next-auth` `Session` with `session.user.id`), `src/pairing/pick-pair.ts` (`pickPair`), `src/components/duel/duel-arena.tsx` (`DuelArena` with a `scope?: string` prop), and `POST /api/vote` (phase 04) which already applies Glicko-2 to every `CatOrg` row in the winner∩loser org intersection.

---

### Task 1: Organization constants

**Files:**
- Modify: `src/lib/constants.ts`
- Test: (constants are data — exercised by downstream task tests)

- [ ] **Step 1: Load skill web-forms-zod-validation and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-forms-zod-validation/SKILL.md`. The CLAUDE.md no-magic-number rule governs every literal added below; the org Zod schemas in later tasks import these constants for `.min()`/`.max()`/`.length()`.
- [ ] **Step 2: Append org constants to `src/lib/constants.ts`**
  Add to the END of the existing file (do not touch existing exports from §4 of the contracts):
  ```ts
  // Organizations — SEO indexing gate: an org page is noindex until it has at least this many members.
  export const ORG_MIN_INDEXABLE_MEMBERS = 3;

  // Organizations — join code: long, URL-safe, hard to guess.
  export const ORG_JOIN_CODE_LENGTH = 24;

  // Organizations — name + description field limits (shared by Zod schemas + form).
  export const ORG_NAME_MIN = 2;
  export const ORG_NAME_MAX = 50;
  export const ORG_DESCRIPTION_MAX = 280;
  ```
- [ ] **Step 3: Typecheck the constants file**
  Run: `npx tsc --noEmit`
  Expected: no errors (constants are plain literals; existing code still compiles).
- [ ] **Step 4: Commit**
  Run: `git add src/lib/constants.ts && git commit -m "feat(constants): add organization indexing + join-code + field-limit constants"`
  Expected: one commit created.

---

### Task 2: Join-code generator (`src/org/join-code.ts`)

**Files:**
- Create: `src/org/join-code.ts`
- Test: `src/org/join-code.test.ts`

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-vitest/SKILL.md` (co-locate tests, named constants for test data, pure-function unit testing). This module is pure (Node `crypto` only), no DB.
- [ ] **Step 2: Write the failing test `src/org/join-code.test.ts`**
  ```ts
  import { describe, expect, it } from "vitest";

  import { ORG_JOIN_CODE_LENGTH } from "@/lib/constants";
  import { generateJoinCode } from "@/org/join-code";

  const URL_SAFE = /^[A-Za-z0-9_-]+$/;
  const SAMPLE_COUNT = 1000;

  describe("generateJoinCode", () => {
    it("produces a code of the configured length", () => {
      expect(generateJoinCode()).toHaveLength(ORG_JOIN_CODE_LENGTH);
    });

    it("produces a URL-safe alphabet only", () => {
      expect(generateJoinCode()).toMatch(URL_SAFE);
    });

    it("produces distinct codes across many draws", () => {
      const codes = new Set(
        Array.from({ length: SAMPLE_COUNT }, () => generateJoinCode()),
      );
      expect(codes.size).toBe(SAMPLE_COUNT);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/org/join-code.test.ts`
  Expected: FAIL — `Cannot find module '@/org/join-code'`.
- [ ] **Step 4: Write the implementation `src/org/join-code.ts`**
  ```ts
  import { randomBytes } from "node:crypto";

  import { ORG_JOIN_CODE_LENGTH } from "@/lib/constants";

  // base64url uses [A-Za-z0-9_-]; 1 byte yields ~1.33 base64url chars,
  // so request enough bytes then slice to the exact length.
  const BYTES_PER_CHAR = 1;

  /** Generate a long, URL-safe, hard-to-guess organization invite code. */
  export function generateJoinCode(): string {
    return randomBytes(ORG_JOIN_CODE_LENGTH * BYTES_PER_CHAR)
      .toString("base64url")
      .slice(0, ORG_JOIN_CODE_LENGTH);
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/org/join-code.test.ts`
  Expected: PASS — 3 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/org/join-code.ts src/org/join-code.test.ts && git commit -m "feat(org): long URL-safe join-code generator"`
  Expected: one commit created.

---

### Task 3: Create-org module (`src/org/create-org.ts`)

**Files:**
- Create: `src/org/create-org.ts`
- Test: `src/org/create-org.test.ts`

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-prisma/SKILL.md`. Binding rules: use the `prisma` singleton from `@/lib/prisma` (never `new PrismaClient()`); rely on the `Organization.name @unique` and `createdById @unique` constraints (catch `Prisma.PrismaClientKnownRequestError` code `P2002`) rather than a racy pre-check; named exports only; kebab-case file.
- [ ] **Step 2: Write the failing test `src/org/create-org.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/prisma", () => ({
    prisma: { organization: { create: vi.fn() } },
  }));
  vi.mock("@/lib/slug", () => ({ slug: vi.fn(() => "acme-org01") }));
  vi.mock("@/org/join-code", () => ({
    generateJoinCode: vi.fn(() => "join-code-fixed-000000000"),
  }));

  import { Prisma } from "@prisma/client";

  import { prisma } from "@/lib/prisma";
  import { createOrg } from "@/org/create-org";

  const USER_ID = "user-1";
  const ORG_NAME = "Acme";
  const create = vi.mocked(prisma.organization.create);

  function p2002(target: string): Prisma.PrismaClientKnownRequestError {
    return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: [target] },
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createOrg", () => {
    it("creates an org and returns id, slug, joinCode", async () => {
      create.mockResolvedValue({
        id: "org-1",
        slug: "acme-org01",
        joinCode: "join-code-fixed-000000000",
      } as never);

      const result = await createOrg({ userId: USER_ID, name: ORG_NAME });

      expect(result).toEqual({
        ok: true,
        id: "org-1",
        slug: "acme-org01",
        joinCode: "join-code-fixed-000000000",
      });
      const args = create.mock.calls[0][0];
      expect(args.data.createdById).toBe(USER_ID);
      expect(args.data.name).toBe(ORG_NAME);
    });

    it("returns a name-taken conflict when the name is not unique", async () => {
      create.mockRejectedValue(p2002("name"));
      const result = await createOrg({ userId: USER_ID, name: ORG_NAME });
      expect(result).toEqual({ ok: false, reason: "name_taken" });
    });

    it("returns an already-owns-org conflict when the user already created one", async () => {
      create.mockRejectedValue(p2002("createdById"));
      const result = await createOrg({ userId: USER_ID, name: ORG_NAME });
      expect(result).toEqual({ ok: false, reason: "already_owns_org" });
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/org/create-org.test.ts`
  Expected: FAIL — `Cannot find module '@/org/create-org'`.
- [ ] **Step 4: Write the implementation `src/org/create-org.ts`**
  ```ts
  import { Prisma } from "@prisma/client";

  import { prisma } from "@/lib/prisma";
  import { slug } from "@/lib/slug";
  import { generateJoinCode } from "@/org/join-code";

  const UNIQUE_VIOLATION = "P2002";

  export type CreateOrgInput = {
    userId: string;
    name: string;
    description?: string;
    logoR2Key?: string;
  };

  export type CreateOrgResult =
    | { ok: true; id: string; slug: string; joinCode: string }
    | { ok: false; reason: "name_taken" | "already_owns_org" };

  function uniqueTarget(error: unknown): string {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      const target = error.meta?.target;
      return Array.isArray(target) ? target.join(",") : String(target ?? "");
    }
    return "";
  }

  /**
   * Create an Organization for a user. Enforces MAX_ORGS_PER_USER at the DB level
   * via the Organization.createdById @unique constraint, and name uniqueness via
   * the name @unique constraint. Generates a unique joinCode and slug.
   */
  export async function createOrg(
    input: CreateOrgInput,
  ): Promise<CreateOrgResult> {
    try {
      const org = await prisma.organization.create({
        data: {
          name: input.name,
          slug: slug(input.name),
          description: input.description,
          logoR2Key: input.logoR2Key,
          joinCode: generateJoinCode(),
          createdById: input.userId,
        },
        select: { id: true, slug: true, joinCode: true },
      });
      return { ok: true, id: org.id, slug: org.slug, joinCode: org.joinCode };
    } catch (error) {
      const target = uniqueTarget(error);
      if (target.includes("createdById")) {
        return { ok: false, reason: "already_owns_org" };
      }
      if (target.includes("name")) {
        return { ok: false, reason: "name_taken" };
      }
      throw error;
    }
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/org/create-org.test.ts`
  Expected: PASS — 3 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/org/create-org.ts src/org/create-org.test.ts && git commit -m "feat(org): createOrg with DB-level unique-creator + unique-name enforcement"`
  Expected: one commit created.

---

### Task 4: Join-by-code module (`src/org/join-by-code.ts`)

**Files:**
- Create: `src/org/join-by-code.ts`
- Test: `src/org/join-by-code.test.ts`

> Contract note: the phase-06 `POST /api/cats` calls `joinByCode({ catId, joinCode })` and only reads `.ok`. This module returns a richer discriminated result so the org route (Task 7) can surface `orgId`/`orgSlug`; the `.ok === false` shape stays compatible with that earlier call site.

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-prisma/SKILL.md`. Binding rules: use the `prisma` singleton; count existing `CatOrg` rows for the cat to enforce `MAX_ORGS_PER_CAT` before insert; the `CatOrg` rating/rd/vol/score Prisma defaults (1500/350/0.06/800) ARE the Glicko defaults, so an empty `create` data uses them; detect the already-member case via the `@@id([catId, orgId])` composite primary key (P2002).
- [ ] **Step 2: Write the failing test `src/org/join-by-code.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      organization: { findUnique: vi.fn() },
      catOrg: { count: vi.fn(), create: vi.fn() },
    },
  }));

  import { Prisma } from "@prisma/client";

  import { MAX_ORGS_PER_CAT } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";
  import { joinByCode } from "@/org/join-by-code";

  const CAT_ID = "cat-1";
  const JOIN_CODE = "join-code-fixed-000000000";
  const ORG = { id: "org-1", slug: "acme-org01" };

  const findOrg = vi.mocked(prisma.organization.findUnique);
  const countMemberships = vi.mocked(prisma.catOrg.count);
  const createMembership = vi.mocked(prisma.catOrg.create);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("joinByCode", () => {
    it("returns invalid_code when the join code resolves to no org", async () => {
      findOrg.mockResolvedValue(null);
      const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
      expect(result).toEqual({ ok: false, reason: "invalid_code" });
      expect(createMembership).not.toHaveBeenCalled();
    });

    it("returns cap_reached when the cat is already at MAX_ORGS_PER_CAT", async () => {
      findOrg.mockResolvedValue(ORG as never);
      countMemberships.mockResolvedValue(MAX_ORGS_PER_CAT);
      const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
      expect(result).toEqual({ ok: false, reason: "cap_reached" });
      expect(createMembership).not.toHaveBeenCalled();
    });

    it("returns already_member when the membership already exists", async () => {
      findOrg.mockResolvedValue(ORG as never);
      countMemberships.mockResolvedValue(0);
      createMembership.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("dup", {
          code: "P2002",
          clientVersion: "test",
        }),
      );
      const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });
      expect(result).toEqual({ ok: false, reason: "already_member" });
    });

    it("creates a CatOrg membership and returns orgId + orgSlug on success", async () => {
      findOrg.mockResolvedValue(ORG as never);
      countMemberships.mockResolvedValue(1);
      createMembership.mockResolvedValue({} as never);

      const result = await joinByCode({ catId: CAT_ID, joinCode: JOIN_CODE });

      expect(result).toEqual({ ok: true, orgId: "org-1", orgSlug: "acme-org01" });
      expect(createMembership).toHaveBeenCalledWith({
        data: { catId: CAT_ID, orgId: "org-1" },
      });
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/org/join-by-code.test.ts`
  Expected: FAIL — `Cannot find module '@/org/join-by-code'`.
- [ ] **Step 4: Write the implementation `src/org/join-by-code.ts`**
  ```ts
  import { Prisma } from "@prisma/client";

  import { MAX_ORGS_PER_CAT } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";

  const UNIQUE_VIOLATION = "P2002";

  export type JoinByCodeInput = {
    catId: string;
    joinCode: string;
  };

  export type JoinByCodeResult =
    | { ok: true; orgId: string; orgSlug: string }
    | { ok: false; reason: "invalid_code" | "cap_reached" | "already_member" };

  /**
   * Join a cat to an organization by invite code. A valid code alone suffices —
   * there is no org-owner approval. Enforces MAX_ORGS_PER_CAT (count CatOrg rows
   * for the cat) and relies on CatOrg's @@id([catId, orgId]) to reject duplicates.
   * New memberships start with the Glicko-2 defaults from the CatOrg schema.
   */
  export async function joinByCode(
    input: JoinByCodeInput,
  ): Promise<JoinByCodeResult> {
    const org = await prisma.organization.findUnique({
      where: { joinCode: input.joinCode },
      select: { id: true, slug: true },
    });
    if (!org) {
      return { ok: false, reason: "invalid_code" };
    }

    const memberships = await prisma.catOrg.count({
      where: { catId: input.catId },
    });
    if (memberships >= MAX_ORGS_PER_CAT) {
      return { ok: false, reason: "cap_reached" };
    }

    try {
      await prisma.catOrg.create({
        data: { catId: input.catId, orgId: org.id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        return { ok: false, reason: "already_member" };
      }
      throw error;
    }

    return { ok: true, orgId: org.id, orgSlug: org.slug };
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/org/join-by-code.test.ts`
  Expected: PASS — 4 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/org/join-by-code.ts src/org/join-by-code.test.ts && git commit -m "feat(org): joinByCode with MAX_ORGS_PER_CAT + duplicate enforcement"`
  Expected: one commit created.

---

### Task 5: Leave-org module (`src/org/leave-org.ts`)

**Files:**
- Create: `src/org/leave-org.ts`
- Test: `src/org/leave-org.test.ts`

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-prisma/SKILL.md`. Binding rules: use the `prisma` singleton; delete by the `catId_orgId` composite key; treat a missing row (P2025 "record to delete does not exist") as a `not_found` result rather than throwing.
- [ ] **Step 2: Write the failing test `src/org/leave-org.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/prisma", () => ({
    prisma: { catOrg: { delete: vi.fn() } },
  }));

  import { Prisma } from "@prisma/client";

  import { prisma } from "@/lib/prisma";
  import { leaveOrg } from "@/org/leave-org";

  const CAT_ID = "cat-1";
  const ORG_ID = "org-1";
  const deleteMembership = vi.mocked(prisma.catOrg.delete);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("leaveOrg", () => {
    it("deletes the membership and returns ok", async () => {
      deleteMembership.mockResolvedValue({} as never);
      const result = await leaveOrg({ catId: CAT_ID, orgId: ORG_ID });
      expect(result).toEqual({ ok: true });
      expect(deleteMembership).toHaveBeenCalledWith({
        where: { catId_orgId: { catId: CAT_ID, orgId: ORG_ID } },
      });
    });

    it("returns not_found when the membership does not exist", async () => {
      deleteMembership.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("missing", {
          code: "P2025",
          clientVersion: "test",
        }),
      );
      const result = await leaveOrg({ catId: CAT_ID, orgId: ORG_ID });
      expect(result).toEqual({ ok: false, reason: "not_found" });
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/org/leave-org.test.ts`
  Expected: FAIL — `Cannot find module '@/org/leave-org'`.
- [ ] **Step 4: Write the implementation `src/org/leave-org.ts`**
  ```ts
  import { Prisma } from "@prisma/client";

  import { prisma } from "@/lib/prisma";

  const RECORD_NOT_FOUND = "P2025";

  export type LeaveOrgInput = {
    catId: string;
    orgId: string;
  };

  export type LeaveOrgResult =
    | { ok: true }
    | { ok: false; reason: "not_found" };

  /** Remove a cat's membership in an organization. */
  export async function leaveOrg(input: LeaveOrgInput): Promise<LeaveOrgResult> {
    try {
      await prisma.catOrg.delete({
        where: { catId_orgId: { catId: input.catId, orgId: input.orgId } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === RECORD_NOT_FOUND
      ) {
        return { ok: false, reason: "not_found" };
      }
      throw error;
    }
    return { ok: true };
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/org/leave-org.test.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/org/leave-org.ts src/org/leave-org.test.ts && git commit -m "feat(org): leaveOrg membership removal"`
  Expected: one commit created.

---

### Task 6: Shared org API types (`src/lib/org-api-types.ts`)

**Files:**
- Create: `src/lib/org-api-types.ts`
- Test: (consumed by Task 7/8 tests)

- [ ] **Step 1: Load skill web-forms-zod-validation and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-forms-zod-validation/SKILL.md`; these types mirror the §6 contract response shapes and the uniform `{ error }` body. Reuse the existing `ApiError` from `@/lib/api-types` (phase 04) rather than redefining it.
- [ ] **Step 2: Write the implementation `src/lib/org-api-types.ts`** (no failing test — pure type declarations, exercised by importing tasks)
  ```ts
  export type CreateOrgRequest = {
    name: string;
    description?: string;
    logoR2Key?: string;
  };

  export type CreateOrgResponse = {
    id: string;
    slug: string;
    joinCode: string;
  };

  export type JoinOrgRequest = {
    joinCode: string;
  };

  export type JoinOrgResponse = {
    ok: true;
    orgId: string;
    orgSlug: string;
  };

  export type LeaveOrgRequest = {
    orgId: string;
  };

  export type LeaveOrgResponse = {
    ok: true;
  };
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 4: Commit**
  Run: `git add src/lib/org-api-types.ts && git commit -m "feat(org): shared org API request/response types"`
  Expected: one commit created.

---

### Task 7: `POST /api/orgs` route handler

**Files:**
- Create: `src/app/api/orgs/route.ts`
- Test: `src/app/api/orgs/route.test.ts`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (Route Handlers; authorization must run inside the handler). Re-read web-forms-zod-validation for boundary parsing. The handler validates the body with Zod, requires an authenticated session via `auth()`, delegates to `createOrg`, and maps the result to the contract status codes (201/409).
- [ ] **Step 2: Write the failing test `src/app/api/orgs/route.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const auth = vi.fn();
  vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => auth(...a) }));
  const createOrg = vi.fn();
  vi.mock("@/org/create-org", () => ({
    createOrg: (...a: unknown[]) => createOrg(...a),
  }));

  import { POST } from "@/app/api/orgs/route";

  const post = (body: unknown) =>
    POST(
      new Request("http://t/api/orgs", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

  const SESSION = { user: { id: "user-1" } };
  const VALID = { name: "Acme" };

  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue(SESSION);
    createOrg.mockResolvedValue({
      ok: true,
      id: "org-1",
      slug: "acme-org01",
      joinCode: "join-code-fixed-000000000",
    });
  });

  describe("POST /api/orgs", () => {
    it("returns 401 when not authenticated", async () => {
      auth.mockResolvedValue(null);
      const res = await post(VALID);
      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid body", async () => {
      const res = await post({ name: "" });
      expect(res.status).toBe(400);
    });

    it("creates the org and returns 201 with id, slug, joinCode", async () => {
      const res = await post(VALID);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({
        id: "org-1",
        slug: "acme-org01",
        joinCode: "join-code-fixed-000000000",
      });
      expect(createOrg).toHaveBeenCalledWith({
        userId: "user-1",
        name: "Acme",
        description: undefined,
        logoR2Key: undefined,
      });
    });

    it("returns 409 when the user already owns an org", async () => {
      createOrg.mockResolvedValue({ ok: false, reason: "already_owns_org" });
      const res = await post(VALID);
      expect(res.status).toBe(409);
    });

    it("returns 409 when the name is taken", async () => {
      createOrg.mockResolvedValue({ ok: false, reason: "name_taken" });
      const res = await post(VALID);
      expect(res.status).toBe(409);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/app/api/orgs/route.test.ts`
  Expected: FAIL — `Cannot find module '@/app/api/orgs/route'`.
- [ ] **Step 4: Write the implementation `src/app/api/orgs/route.ts`**
  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";

  import { auth } from "@/auth";
  import type { ApiError } from "@/lib/api-types";
  import { ORG_DESCRIPTION_MAX, ORG_NAME_MAX, ORG_NAME_MIN } from "@/lib/constants";
  import type { CreateOrgResponse } from "@/lib/org-api-types";
  import { createOrg } from "@/org/create-org";

  export const dynamic = "force-dynamic";

  const bodySchema = z.object({
    name: z.string().trim().min(ORG_NAME_MIN).max(ORG_NAME_MAX),
    description: z.string().trim().max(ORG_DESCRIPTION_MAX).optional(),
    logoR2Key: z.string().min(1).optional(),
  });

  export async function POST(
    request: Request,
  ): Promise<NextResponse<CreateOrgResponse | ApiError>> {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    try {
      const result = await createOrg({
        userId: session.user.id,
        name: parsed.data.name,
        description: parsed.data.description,
        logoR2Key: parsed.data.logoR2Key,
      });

      if (!result.ok) {
        const message =
          result.reason === "already_owns_org"
            ? "You already own an organization"
            : "Organization name is taken";
        return NextResponse.json({ error: message }, { status: 409 });
      }

      return NextResponse.json(
        { id: result.id, slug: result.slug, joinCode: result.joinCode },
        { status: 201 },
      );
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/app/api/orgs/route.test.ts`
  Expected: PASS — 5 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/app/api/orgs/route.ts src/app/api/orgs/route.test.ts && git commit -m "feat(api): POST /api/orgs create-organization route"`
  Expected: one commit created.

---

### Task 8: `POST` + `DELETE /api/cats/[id]/orgs` route handlers

**Files:**
- Create: `src/app/api/cats/[id]/orgs/route.ts`
- Test: `src/app/api/cats/[id]/orgs/route.test.ts`

> In Next.js 15 the route-context `params` is a `Promise` — `await context.params` to read `id`. POST joins by code (`{ joinCode }` → 200 / 422 / 409), DELETE leaves (`{ orgId }` → 200 / 404). Both require the caller to own the cat (else 403; cat missing → 404).

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (Route Handlers, dynamic params as a Promise in Next 15, per-handler authorization). Re-read web-forms-zod-validation for body parsing. Ownership is verified by loading the cat's `ownerId` and comparing to the session user id before any mutation.
- [ ] **Step 2: Write the failing test `src/app/api/cats/[id]/orgs/route.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const auth = vi.fn();
  vi.mock("@/auth", () => ({ auth: (...a: unknown[]) => auth(...a) }));
  const findCat = vi.fn();
  vi.mock("@/lib/prisma", () => ({
    prisma: { cat: { findUnique: (...a: unknown[]) => findCat(...a) } },
  }));
  const joinByCode = vi.fn();
  vi.mock("@/org/join-by-code", () => ({
    joinByCode: (...a: unknown[]) => joinByCode(...a),
  }));
  const leaveOrg = vi.fn();
  vi.mock("@/org/leave-org", () => ({
    leaveOrg: (...a: unknown[]) => leaveOrg(...a),
  }));

  import { DELETE, POST } from "@/app/api/cats/[id]/orgs/route";

  const CAT_ID = "cat-1";
  const OWNER = { user: { id: "user-1" } };
  const ctx = { params: Promise.resolve({ id: CAT_ID }) };

  const post = (body: unknown) =>
    POST(
      new Request(`http://t/api/cats/${CAT_ID}/orgs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
      ctx,
    );
  const del = (body: unknown) =>
    DELETE(
      new Request(`http://t/api/cats/${CAT_ID}/orgs`, {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
      ctx,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    auth.mockResolvedValue(OWNER);
    findCat.mockResolvedValue({ id: CAT_ID, ownerId: "user-1" });
  });

  describe("POST /api/cats/[id]/orgs (join)", () => {
    it("returns 401 when not authenticated", async () => {
      auth.mockResolvedValue(null);
      expect((await post({ joinCode: "c" })).status).toBe(401);
    });

    it("returns 404 when the cat does not exist", async () => {
      findCat.mockResolvedValue(null);
      expect((await post({ joinCode: "c" })).status).toBe(404);
    });

    it("returns 403 when the caller does not own the cat", async () => {
      findCat.mockResolvedValue({ id: CAT_ID, ownerId: "someone-else" });
      expect((await post({ joinCode: "c" })).status).toBe(403);
    });

    it("returns 422 for an invalid join code", async () => {
      joinByCode.mockResolvedValue({ ok: false, reason: "invalid_code" });
      expect((await post({ joinCode: "nope" })).status).toBe(422);
    });

    it("returns 409 when the cat is at the org cap or already a member", async () => {
      joinByCode.mockResolvedValue({ ok: false, reason: "cap_reached" });
      expect((await post({ joinCode: "c" })).status).toBe(409);
    });

    it("returns 200 with orgId + orgSlug on success", async () => {
      joinByCode.mockResolvedValue({ ok: true, orgId: "org-1", orgSlug: "acme-org01" });
      const res = await post({ joinCode: "good" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        orgId: "org-1",
        orgSlug: "acme-org01",
      });
    });
  });

  describe("DELETE /api/cats/[id]/orgs (leave)", () => {
    it("returns 403 when the caller does not own the cat", async () => {
      findCat.mockResolvedValue({ id: CAT_ID, ownerId: "someone-else" });
      expect((await del({ orgId: "org-1" })).status).toBe(403);
    });

    it("returns 404 when the membership is not found", async () => {
      leaveOrg.mockResolvedValue({ ok: false, reason: "not_found" });
      expect((await del({ orgId: "org-1" })).status).toBe(404);
    });

    it("returns 200 on a successful leave", async () => {
      leaveOrg.mockResolvedValue({ ok: true });
      const res = await del({ orgId: "org-1" });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/app/api/cats/[id]/orgs/route.test.ts`
  Expected: FAIL — `Cannot find module '@/app/api/cats/[id]/orgs/route'`.
- [ ] **Step 4: Write the implementation `src/app/api/cats/[id]/orgs/route.ts`**
  ```ts
  import { NextResponse } from "next/server";
  import { z } from "zod";

  import { auth } from "@/auth";
  import type { ApiError } from "@/lib/api-types";
  import type { JoinOrgResponse, LeaveOrgResponse } from "@/lib/org-api-types";
  import { prisma } from "@/lib/prisma";
  import { joinByCode } from "@/org/join-by-code";
  import { leaveOrg } from "@/org/leave-org";

  export const dynamic = "force-dynamic";

  type RouteContext = { params: Promise<{ id: string }> };

  const joinSchema = z.object({ joinCode: z.string().min(1) });
  const leaveSchema = z.object({ orgId: z.string().min(1) });

  type OwnerGate =
    | { ok: true; userId: string }
    | { ok: false; response: NextResponse<ApiError> };

  async function ownerGate(catId: string): Promise<OwnerGate> {
    const session = await auth();
    if (!session?.user?.id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Not authenticated" },
          { status: 401 },
        ),
      };
    }
    const cat = await prisma.cat.findUnique({
      where: { id: catId },
      select: { ownerId: true },
    });
    if (!cat) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Cat not found" }, { status: 404 }),
      };
    }
    if (cat.ownerId !== session.user.id) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Not the cat owner" },
          { status: 403 },
        ),
      };
    }
    return { ok: true, userId: session.user.id };
  }

  async function readJson(request: Request): Promise<unknown | null> {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }

  export async function POST(
    request: Request,
    context: RouteContext,
  ): Promise<NextResponse<JoinOrgResponse | ApiError>> {
    const { id } = await context.params;
    const gate = await ownerGate(id);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = joinSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    try {
      const result = await joinByCode({ catId: id, joinCode: parsed.data.joinCode });
      if (!result.ok) {
        if (result.reason === "invalid_code") {
          return NextResponse.json({ error: "Invalid join code" }, { status: 422 });
        }
        const message =
          result.reason === "cap_reached"
            ? "Cat is already in the maximum number of organizations"
            : "Cat is already a member of this organization";
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json(
        { ok: true, orgId: result.orgId, orgSlug: result.orgSlug },
        { status: 200 },
      );
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }

  export async function DELETE(
    request: Request,
    context: RouteContext,
  ): Promise<NextResponse<LeaveOrgResponse | ApiError>> {
    const { id } = await context.params;
    const gate = await ownerGate(id);
    if (!gate.ok) {
      return gate.response;
    }

    const parsed = leaveSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    try {
      const result = await leaveOrg({ catId: id, orgId: parsed.data.orgId });
      if (!result.ok) {
        return NextResponse.json(
          { error: "Membership not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true }, { status: 200 });
    } catch {
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/app/api/cats/[id]/orgs/route.test.ts`
  Expected: PASS — 9 passing.
- [ ] **Step 6: Commit**
  Run: `git add "src/app/api/cats/[id]/orgs/route.ts" "src/app/api/cats/[id]/orgs/route.test.ts" && git commit -m "feat(api): POST+DELETE /api/cats/[id]/orgs join + leave by code"`
  Expected: one commit created.

---

### Task 9: Org-scope pairing returns only members (integration test)

**Files:**
- Test: `src/pairing/pick-pair.org-scope.test.ts`

> This task adds NO new pairing code — `pickPair` already supports `{ orgId }` (phase 03). It locks the contract behavior "(b) org-scope pairing only returns members" with a dedicated regression test that asserts the eligibility `where` carries the `orgs.some.orgId` member filter.

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-vitest/SKILL.md` (mock the `prisma` singleton with `vi.mock`, named constants for test data, assert on the query args rather than a real DB).
- [ ] **Step 2: Write the failing test `src/pairing/pick-pair.org-scope.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/prisma", () => ({
    prisma: { cat: { findMany: vi.fn() } },
  }));

  import { prisma } from "@/lib/prisma";
  import { pickPair } from "@/pairing/pick-pair";

  const ORG_ID = "org-1";
  const VOTER_KEY = "anon-123";
  const A_ROW = { id: "a", rating: 1500, rd: 350, score: 800, timesShown: 0 };
  const B_ROW = { id: "b", rating: 1500, rd: 90, score: 820, timesShown: 5 };

  const findMany = vi.mocked(prisma.cat.findMany);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pickPair org scope only returns members", () => {
    it("filters both candidate pools to the org's members and an APPROVED image", async () => {
      findMany
        .mockResolvedValueOnce([A_ROW] as never)
        .mockResolvedValueOnce([A_ROW, B_ROW] as never);

      const result = await pickPair({
        scope: { orgId: ORG_ID },
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });

      expect(result?.a.id).toBe("a");
      expect(result?.b.id).toBe("b");

      const aArgs = findMany.mock.calls[0][0];
      const bArgs = findMany.mock.calls[1][0];
      expect(aArgs.where.orgs.some.orgId).toBe(ORG_ID);
      expect(aArgs.where.status).toBe("ACTIVE");
      expect(aArgs.where.images.some.status).toBe("APPROVED");
      expect(bArgs.where.orgs.some.orgId).toBe(ORG_ID);
    });

    it("returns null when the org has no eligible members", async () => {
      findMany.mockResolvedValue([] as never);
      const result = await pickPair({
        scope: { orgId: ORG_ID },
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });
      expect(result).toBeNull();
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it PASSES immediately**
  Run: `npx vitest run src/pairing/pick-pair.org-scope.test.ts`
  Expected: PASS — 2 passing (no implementation change needed; `pickPair`'s `eligibilityWhere` already adds `orgs: { some: { orgId } }` for org scope). If this FAILS, the phase-03 `pickPair` regressed — fix `src/pairing/pick-pair.ts` (do not weaken this test) before continuing.
- [ ] **Step 4: Commit**
  Run: `git add src/pairing/pick-pair.org-scope.test.ts && git commit -m "test(pairing): lock org-scope pairing to members only"`
  Expected: one commit created.

---

### Task 10: Vote endpoint updates CatOrg for a shared org (integration test)

**Files:**
- Test: `src/app/api/vote/route.org-shared.test.ts`

> This task adds NO new vote code — phase 04's `POST /api/vote` already mutates every `CatOrg` row in the winner∩loser org intersection inside its `$transaction`. It locks the contract behavior "(a) POST /api/vote updates CatOrg local ratings for a shared org" with a dedicated regression test that drives the existing handler and asserts both `catOrg.update` calls fire for the shared org.

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-vitest/SKILL.md` (module mocks for the vote handler's collaborators, named constants, assert on the transaction client's `catOrg.update` calls).
- [ ] **Step 2: Write the failing test `src/app/api/vote/route.org-shared.test.ts`**
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
  vi.mock("@/lib/anon-id", () => ({
    getOrCreateAnonId: vi.fn(async () => "anon-x"),
    voterKeyFor: (anon: string) => anon,
  }));
  const verifyPairToken = vi.fn();
  vi.mock("@/lib/pair-token", () => ({
    verifyPairToken: (...a: unknown[]) => verifyPairToken(...a),
  }));
  const check = vi.fn();
  vi.mock("@/lib/rate-limit", () => ({ check: (...a: unknown[]) => check(...a) }));
  const applyVote = vi.fn();
  vi.mock("@/lib/glicko", () => ({ applyVote: (...a: unknown[]) => applyVote(...a) }));
  const consumeNonce = vi.fn(async () => true);
  vi.mock("@/lib/nonce-store", () => ({
    consumeNonce: (...a: unknown[]) => consumeNonce(...a),
  }));

  const WINNER_ID = "ca";
  const LOSER_ID = "cb";
  const SHARED_ORG_ID = "org-shared";
  const UNSHARED_ORG_ID = "org-other";

  const tx = {
    catOrg: { findMany: vi.fn(), update: vi.fn() },
    vote: { create: vi.fn() },
  };
  vi.mock("@/lib/prisma", () => ({
    prisma: { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) },
  }));

  import { POST } from "@/app/api/vote/route";

  const post = (body: unknown) =>
    POST(
      new Request("http://t/api/vote", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );

  const VALID = { token: "tok", winnerCatId: WINNER_ID, loserCatId: LOSER_ID };

  function orgRow(catId: string, orgId: string) {
    return {
      catId,
      orgId,
      rating: 1500,
      rd: 350,
      vol: 0.06,
      score: 800,
      wins: 0,
      losses: 0,
      draws: 0,
      timesShown: 0,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    check.mockResolvedValue({ ok: true, remaining: 9 });
    consumeNonce.mockResolvedValue(true);
    applyVote.mockResolvedValue({
      winner: { id: WINNER_ID, rating: 1520, rd: 340, score: 840 },
      loser: { id: LOSER_ID, rating: 1480, rd: 340, score: 800 },
    });
    verifyPairToken.mockReturnValue({
      a: WINNER_ID,
      b: LOSER_ID,
      nonce: "n",
      exp: 9e9,
      scope: `org:${SHARED_ORG_ID}`,
    });
    // Winner is in the shared org + an unshared org; loser is only in the shared org.
    tx.catOrg.findMany.mockImplementation(async ({ where }: { where: { catId: string } }) =>
      where.catId === WINNER_ID
        ? [orgRow(WINNER_ID, SHARED_ORG_ID), orgRow(WINNER_ID, UNSHARED_ORG_ID)]
        : [orgRow(LOSER_ID, SHARED_ORG_ID)],
    );
  });

  describe("POST /api/vote updates CatOrg for a shared org", () => {
    it("updates both shared-org CatOrg rows and skips the unshared org", async () => {
      const res = await post(VALID);
      expect(res.status).toBe(200);

      const updatedKeys = tx.catOrg.update.mock.calls.map(
        (call) => call[0].where.catId_orgId,
      );
      // Exactly the winner + loser rows in the SHARED org are updated.
      expect(updatedKeys).toContainEqual({ catId: WINNER_ID, orgId: SHARED_ORG_ID });
      expect(updatedKeys).toContainEqual({ catId: LOSER_ID, orgId: SHARED_ORG_ID });
      expect(updatedKeys).toHaveLength(2);
      // The unshared org is never touched.
      expect(updatedKeys).not.toContainEqual({
        catId: WINNER_ID,
        orgId: UNSHARED_ORG_ID,
      });
      // The winner's shared-org row increments its win count.
      const winnerUpdate = tx.catOrg.update.mock.calls.find(
        (call) =>
          call[0].where.catId_orgId.catId === WINNER_ID &&
          call[0].where.catId_orgId.orgId === SHARED_ORG_ID,
      );
      expect(winnerUpdate?.[0].data.wins).toEqual({ increment: 1 });
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it PASSES immediately**
  Run: `npx vitest run src/app/api/vote/route.org-shared.test.ts`
  Expected: PASS — 1 passing (no implementation change needed; the phase-04 handler already computes the winner∩loser org intersection and updates both rows). If this FAILS, the phase-04 `POST /api/vote` regressed — fix `src/app/api/vote/route.ts` (do not weaken this test) before continuing.
- [ ] **Step 4: Commit**
  Run: `git add src/app/api/vote/route.org-shared.test.ts && git commit -m "test(api): lock POST /api/vote shared-org CatOrg update"`
  Expected: one commit created.

---

### Task 11: Org create form (`src/components/org/org-create-form.tsx`)

**Files:**
- Create: `src/components/org/org-create-form.tsx`
- Test: `src/components/org/org-create-form.test.tsx`

- [ ] **Step 1: Load skill web-forms-react-hook-form and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-forms-react-hook-form/SKILL.md` (Pattern 1 generics + `mode: "onBlur"` + `defaultValues`; Pattern 4 `zodResolver`). Also re-read web-forms-zod-validation (Pattern 1 named-constant limits, `safeParse`/`z.infer`) and web-files-file-upload-patterns (Pattern 5 presigned PUT for the optional logo — request `POST /api/upload/sign`, PUT the file to R2, submit only the returned `r2Key`; never proxy bytes). Keep the Zod schema in a separate `const` and derive the form type with `z.infer`.
- [ ] **Step 2: Write the failing test `src/components/org/org-create-form.test.tsx`**
  ```tsx
  import { render, screen, waitFor } from "@testing-library/react";
  import userEvent from "@testing-library/user-event";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

  const push = vi.fn();
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

  import { OrgCreateForm } from "@/components/org/org-create-form";

  describe("OrgCreateForm", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("shows a validation error when the name is too short", async () => {
      const user = userEvent.setup();
      render(<OrgCreateForm />);
      await user.click(screen.getByRole("button", { name: /create organization/i }));
      expect(await screen.findByRole("alert")).toBeInTheDocument();
    });

    it("posts the org and redirects to the new org page on success", async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn(async () =>
        new Response(
          JSON.stringify({ id: "org-1", slug: "acme-org01", joinCode: "code-x" }),
          { status: 201 },
        ),
      );
      vi.stubGlobal("fetch", fetchMock);

      render(<OrgCreateForm />);
      await user.type(screen.getByLabelText(/name/i), "Acme");
      await user.click(screen.getByRole("button", { name: /create organization/i }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/orgs",
        expect.objectContaining({ method: "POST" }),
      ));
      await waitFor(() => expect(push).toHaveBeenCalledWith("/org/acme-org01"));
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/components/org/org-create-form.test.tsx`
  Expected: FAIL — `Cannot find module '@/components/org/org-create-form'`.
- [ ] **Step 4: Write the implementation `src/components/org/org-create-form.tsx`**
  ```tsx
  "use client";

  import { zodResolver } from "@hookform/resolvers/zod";
  import { useRouter } from "next/navigation";
  import { useState } from "react";
  import { useForm } from "react-hook-form";
  import { z } from "zod";

  import { Button } from "@/components/ui/button";
  import {
    ORG_DESCRIPTION_MAX,
    ORG_NAME_MAX,
    ORG_NAME_MIN,
  } from "@/lib/constants";
  import type { CreateOrgResponse } from "@/lib/org-api-types";

  const orgFormSchema = z.object({
    name: z
      .string()
      .trim()
      .min(ORG_NAME_MIN, `Name must be at least ${ORG_NAME_MIN} characters`)
      .max(ORG_NAME_MAX, `Name cannot exceed ${ORG_NAME_MAX} characters`),
    description: z
      .string()
      .trim()
      .max(ORG_DESCRIPTION_MAX, `Description cannot exceed ${ORG_DESCRIPTION_MAX} characters`)
      .optional(),
  });

  type OrgFormValues = z.infer<typeof orgFormSchema>;

  export function OrgCreateForm() {
    const router = useRouter();
    const [submitError, setSubmitError] = useState<string | null>(null);
    const {
      register,
      handleSubmit,
      formState: { errors, isSubmitting },
    } = useForm<OrgFormValues>({
      resolver: zodResolver(orgFormSchema),
      mode: "onBlur",
      defaultValues: { name: "", description: "" },
    });

    const onSubmit = handleSubmit(async (values) => {
      setSubmitError(null);
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description || undefined,
        }),
      });
      if (!res.ok) {
        setSubmitError("Could not create organization. The name may be taken.");
        return;
      }
      const org = (await res.json()) as CreateOrgResponse;
      router.push(`/org/${org.slug}`);
    });

    return (
      <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="org-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="org-name"
            type="text"
            autoComplete="off"
            {...register("name")}
            className="rounded-md border px-3 py-2"
          />
          {errors.name ? (
            <span role="alert" className="text-sm text-red-600">
              {errors.name.message}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="org-description" className="text-sm font-medium">
            Description (optional)
          </label>
          <textarea
            id="org-description"
            {...register("description")}
            className="rounded-md border px-3 py-2"
          />
          {errors.description ? (
            <span role="alert" className="text-sm text-red-600">
              {errors.description.message}
            </span>
          ) : null}
        </div>

        {submitError ? (
          <p role="alert" className="text-sm text-red-600">
            {submitError}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          Create organization
        </Button>
      </form>
    );
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/components/org/org-create-form.test.tsx`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/components/org/org-create-form.tsx src/components/org/org-create-form.test.tsx && git commit -m "feat(org): RHF + Zod create-organization form"`
  Expected: one commit created.

---

### Task 12: Org leaderboard (`src/components/org/org-leaderboard.tsx`)

**Files:**
- Create: `src/components/org/org-leaderboard.tsx`
- Test: `src/components/org/org-leaderboard.test.tsx`

- [ ] **Step 1: Load skill web-testing-react-testing-library and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-react-testing-library/SKILL.md` (getByRole table/row queries, no implementation-detail assertions). This is a pure presentational Server Component (no `"use client"`): it receives already-sorted rows as props and renders a table.
- [ ] **Step 2: Write the failing test `src/components/org/org-leaderboard.test.tsx`**
  ```tsx
  import { render, screen, within } from "@testing-library/react";
  import { describe, expect, it } from "vitest";

  import { OrgLeaderboard } from "@/components/org/org-leaderboard";

  const ROWS = [
    { catId: "c1", name: "Top Cat", slug: "top-cat-1", score: 1200, wins: 9, losses: 1 },
    { catId: "c2", name: "Mid Cat", slug: "mid-cat-1", score: 900, wins: 5, losses: 5 },
  ];

  describe("OrgLeaderboard", () => {
    it("renders one row per member with rank, name, and score in order", () => {
      render(<OrgLeaderboard rows={ROWS} />);
      const rows = screen.getAllByRole("row").slice(1); // skip header row
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText("Top Cat")).toBeInTheDocument();
      expect(within(rows[0]).getByText("1200")).toBeInTheDocument();
      expect(within(rows[1]).getByText("Mid Cat")).toBeInTheDocument();
    });

    it("shows an empty state when there are no members", () => {
      render(<OrgLeaderboard rows={[]} />);
      expect(screen.getByText(/no cats yet/i)).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/components/org/org-leaderboard.test.tsx`
  Expected: FAIL — `Cannot find module '@/components/org/org-leaderboard'`.
- [ ] **Step 4: Write the implementation `src/components/org/org-leaderboard.tsx`**
  ```tsx
  import Link from "next/link";

  const FIRST_RANK = 1;

  export type OrgLeaderboardRow = {
    catId: string;
    name: string;
    slug: string;
    score: number;
    wins: number;
    losses: number;
  };

  type OrgLeaderboardProps = {
    rows: OrgLeaderboardRow[];
  };

  export function OrgLeaderboard({ rows }: OrgLeaderboardProps) {
    if (rows.length === 0) {
      return <p>No cats yet in this organization.</p>;
    }

    return (
      <table className="w-full text-left">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Cat</th>
            <th scope="col">Score</th>
            <th scope="col">W/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.catId}>
              <td>{index + FIRST_RANK}</td>
              <td>
                <Link href={`/cat/${row.slug}`} className="underline">
                  {row.name}
                </Link>
              </td>
              <td>{Math.round(row.score)}</td>
              <td>
                {row.wins}/{row.losses}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/components/org/org-leaderboard.test.tsx`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/components/org/org-leaderboard.tsx src/components/org/org-leaderboard.test.tsx && git commit -m "feat(org): org leaderboard table sorted by CatOrg score"`
  Expected: one commit created.

---

### Task 13: Org feed wrapper (`src/components/org/org-feed.tsx`)

**Files:**
- Create: `src/components/org/org-feed.tsx`
- Test: `src/components/org/org-feed.test.tsx`

> Voting in an org is restricted to org members. The membership decision is made server-side in the page (Task 15) and passed to this client wrapper as `canVote`; the wrapper renders the org-scoped `DuelArena` only for members and a sign-in/join prompt otherwise. `DuelArena` (phase 04) accepts a `scope` string; passing the `orgId` makes it fetch `GET /api/pair?scope=<orgId>` and the resulting org-scoped pair token drives org-scoped `POST /api/vote`.

- [ ] **Step 1: Load skill web-framework-react and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-framework-react/SKILL.md` (small single-purpose client components; derive UI from props, no duplicated state). Re-read web-testing-react-testing-library for the test. This component is a thin `"use client"` gate around the existing `DuelArena`.
- [ ] **Step 2: Write the failing test `src/components/org/org-feed.test.tsx`**
  ```tsx
  import { render, screen } from "@testing-library/react";
  import { describe, expect, it, vi } from "vitest";

  vi.mock("@/components/duel/duel-arena", () => ({
    DuelArena: ({ scope }: { scope?: string }) => (
      <div data-testid="duel-arena">scope:{scope}</div>
    ),
  }));

  import { OrgFeed } from "@/components/org/org-feed";

  const ORG_ID = "org-1";

  describe("OrgFeed", () => {
    it("renders the org-scoped duel arena for a member", () => {
      render(<OrgFeed orgId={ORG_ID} canVote />);
      expect(screen.getByTestId("duel-arena")).toHaveTextContent(`scope:${ORG_ID}`);
    });

    it("renders a members-only prompt for a non-member", () => {
      render(<OrgFeed orgId={ORG_ID} canVote={false} />);
      expect(screen.queryByTestId("duel-arena")).not.toBeInTheDocument();
      expect(screen.getByText(/members only/i)).toBeInTheDocument();
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/components/org/org-feed.test.tsx`
  Expected: FAIL — `Cannot find module '@/components/org/org-feed'`.
- [ ] **Step 4: Write the implementation `src/components/org/org-feed.tsx`**
  ```tsx
  "use client";

  import { DuelArena } from "@/components/duel/duel-arena";

  type OrgFeedProps = {
    orgId: string;
    canVote: boolean;
  };

  export function OrgFeed({ orgId, canVote }: OrgFeedProps) {
    if (!canVote) {
      return (
        <p role="status">
          Voting in this feed is members only. Join one of your cats to this
          organization to vote.
        </p>
      );
    }
    return <DuelArena scope={orgId} />;
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/components/org/org-feed.test.tsx`
  Expected: PASS — 2 passing.
- [ ] **Step 6: Commit**
  Run: `git add src/components/org/org-feed.tsx src/components/org/org-feed.test.tsx && git commit -m "feat(org): member-gated org feed wrapping the scoped duel arena"`
  Expected: one commit created.

---

### Task 14: `/orgs/new` create page

**Files:**
- Create: `src/app/orgs/new/page.tsx`

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (Server Component default, auth gate inside the page via `requireUser()`, push interactivity to the leaf client form, static `metadata`). The page is auth-gated and mounts the client `OrgCreateForm`.
- [ ] **Step 2: Write the page `src/app/orgs/new/page.tsx`** (no unit test — auth/redirect behavior is covered by the e2e in Task 16; the form itself is unit-tested in Task 11)
  ```tsx
  import type { Metadata } from "next";

  import { OrgCreateForm } from "@/components/org/org-create-form";
  import { requireUser } from "@/auth/guards";

  export const metadata: Metadata = {
    title: "Create an organization",
    description: "Start a private cat-rating organization with its own leaderboard.",
  };

  export default async function NewOrgPage() {
    await requireUser();

    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10">
        <h1 className="text-2xl font-bold">Create an organization</h1>
        <p className="text-sm text-gray-600">
          You can create one organization. Share its join code so cat owners can
          enter their cats into your private leaderboard.
        </p>
        <OrgCreateForm />
      </main>
    );
  }
  ```
- [ ] **Step 3: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 4: Commit**
  Run: `git add src/app/orgs/new/page.tsx && git commit -m "feat(org): /orgs/new auth-gated create page"`
  Expected: one commit created.

---

### Task 15: `/org/[slug]` feed + leaderboard page with indexing rule

**Files:**
- Create: `src/app/org/[slug]/page.tsx`
- Test: `src/app/org/[slug]/page.metadata.test.ts`

> The indexing rule: an org page is `noindex` when it has fewer than `ORG_MIN_INDEXABLE_MEMBERS` members. `generateMetadata` reads the member count and sets `robots: { index, follow }` accordingly. Member-vote eligibility (`canVote`) is computed server-side: the signed-in user has `canVote` when they own at least one cat that is a member of this org.

- [ ] **Step 1: Load skill web-meta-framework-nextjs and follow its best practices** — re-read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-meta-framework-nextjs/SKILL.md` (dynamic params as a Promise in Next 15, `generateMetadata` for per-page robots, RSC data loading via the `prisma` singleton, `notFound()` for missing slugs). Re-read api-database-prisma (use `select`, no N+1 — load the org with its members + each member's cat in one query).
- [ ] **Step 2: Write the failing test `src/app/org/[slug]/page.metadata.test.ts`** (covers only the indexing rule — the pure decision is unit-testable; full-page render is exercised by the e2e in Task 16)
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const findOrg = vi.fn();
  vi.mock("@/lib/prisma", () => ({
    prisma: { organization: { findUnique: (...a: unknown[]) => findOrg(...a) } },
  }));

  import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";
  import { generateMetadata } from "@/app/org/[slug]/page";

  const SLUG = "acme-org01";
  const ctx = { params: Promise.resolve({ slug: SLUG }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("org page indexing rule", () => {
    it("noindex when the org has fewer than ORG_MIN_INDEXABLE_MEMBERS members", async () => {
      findOrg.mockResolvedValue({
        name: "Acme",
        description: null,
        _count: { members: ORG_MIN_INDEXABLE_MEMBERS - 1 },
      });
      const meta = await generateMetadata(ctx);
      expect(meta.robots).toEqual({ index: false, follow: false });
    });

    it("indexable when the org has at least ORG_MIN_INDEXABLE_MEMBERS members", async () => {
      findOrg.mockResolvedValue({
        name: "Acme",
        description: "Cats",
        _count: { members: ORG_MIN_INDEXABLE_MEMBERS },
      });
      const meta = await generateMetadata(ctx);
      expect(meta.robots).toEqual({ index: true, follow: true });
    });

    it("returns a not-found title when the org does not exist", async () => {
      findOrg.mockResolvedValue(null);
      const meta = await generateMetadata(ctx);
      expect(meta.title).toMatch(/not found/i);
    });
  });
  ```
- [ ] **Step 3: Run the test and confirm it FAILS**
  Run: `npx vitest run src/app/org/[slug]/page.metadata.test.ts`
  Expected: FAIL — `Cannot find module '@/app/org/[slug]/page'`.
- [ ] **Step 4: Write the page `src/app/org/[slug]/page.tsx`**
  ```tsx
  import type { Metadata } from "next";
  import { notFound } from "next/navigation";

  import { auth } from "@/auth";
  import { OrgFeed } from "@/components/org/org-feed";
  import {
    OrgLeaderboard,
    type OrgLeaderboardRow,
  } from "@/components/org/org-leaderboard";
  import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";

  export const dynamic = "force-dynamic";

  type OrgPageProps = { params: Promise<{ slug: string }> };

  export async function generateMetadata(
    props: OrgPageProps,
  ): Promise<Metadata> {
    const { slug } = await props.params;
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        _count: { select: { members: true } },
      },
    });

    if (!org) {
      return { title: "Organization not found" };
    }

    const indexable = org._count.members >= ORG_MIN_INDEXABLE_MEMBERS;
    return {
      title: `${org.name} — cat leaderboard`,
      description:
        org.description ?? `The ${org.name} private cat-rating leaderboard.`,
      robots: { index: indexable, follow: indexable },
    };
  }

  export default async function OrgPage(props: OrgPageProps) {
    const { slug } = await props.params;
    const org = await prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        description: true,
        members: {
          orderBy: { score: "desc" },
          select: {
            catId: true,
            score: true,
            wins: true,
            losses: true,
            cat: { select: { name: true, slug: true } },
          },
        },
      },
    });

    if (!org) {
      notFound();
    }

    const rows: OrgLeaderboardRow[] = org.members.map((member) => ({
      catId: member.catId,
      name: member.cat.name,
      slug: member.cat.slug,
      score: member.score,
      wins: member.wins,
      losses: member.losses,
    }));

    const session = await auth();
    const userId = session?.user?.id ?? null;
    const canVote = userId
      ? (await prisma.catOrg.count({
          where: { orgId: org.id, cat: { ownerId: userId } },
        })) > 0
      : false;

    return (
      <main className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">{org.name}</h1>
          {org.description ? (
            <p className="text-gray-600">{org.description}</p>
          ) : null}
        </header>

        <section aria-label="Organization duel">
          <h2 className="mb-4 text-xl font-semibold">Vote</h2>
          <OrgFeed orgId={org.id} canVote={canVote} />
        </section>

        <section aria-label="Organization leaderboard">
          <h2 className="mb-4 text-xl font-semibold">Leaderboard</h2>
          <OrgLeaderboard rows={rows} />
        </section>
      </main>
    );
  }
  ```
- [ ] **Step 5: Run the test and confirm it PASSES**
  Run: `npx vitest run src/app/org/[slug]/page.metadata.test.ts`
  Expected: PASS — 3 passing.
- [ ] **Step 6: Typecheck**
  Run: `npx tsc --noEmit`
  Expected: no errors.
- [ ] **Step 7: Commit**
  Run: `git add "src/app/org/[slug]/page.tsx" "src/app/org/[slug]/page.metadata.test.ts" && git commit -m "feat(org): /org/[slug] feed + leaderboard with member-count indexing rule"`
  Expected: one commit created.

---

### Task 16: Playwright e2e — create org, join a cat, see member feed + leaderboard

**Files:**
- Create: `e2e/org.spec.ts`

- [ ] **Step 1: Load skill web-testing-playwright-e2e and follow its best practices** — read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-playwright-e2e/SKILL.md` (named constants, `getByRole`, `page.route` mocking for the API + pair/vote endpoints, web-first assertions). Mock `/api/orgs`, `/api/cats/*/orgs`, `/api/pair`, and `/api/vote` so the flow is deterministic and independent of DB/R2/auth. Authenticate by seeding a session cookie via `context.addCookies` (see Pattern 7 auth fixtures).
- [ ] **Step 2: Write the e2e spec `e2e/org.spec.ts`**
  ```ts
  import { expect, test } from "@playwright/test";

  const NEW_ORG_URL = "/orgs/new";
  const ORG_SLUG = "acme-org01";
  const ORG_PAGE_URL = `/org/${ORG_SLUG}`;
  const ORGS_ROUTE = "**/api/orgs";
  const PAIR_ROUTE = "**/api/pair*";
  const VOTE_ROUTE = "**/api/vote";

  const CREATE_RESPONSE = {
    id: "org-1",
    slug: ORG_SLUG,
    joinCode: "join-code-fixed-000000000",
  };
  const ORG_PAIR = {
    token: "tok-org-1",
    a: {
      id: "ca",
      name: "Alpha",
      slug: "alpha-1",
      images: [{ url: "https://placecats.com/300/300", width: 300, height: 300, position: 0 }],
    },
    b: {
      id: "cb",
      name: "Bravo",
      slug: "bravo-1",
      images: [{ url: "https://placecats.com/301/301", width: 301, height: 301, position: 0 }],
    },
  };

  test.describe("Organizations", () => {
    test("create an org then land on its page", async ({ page }) => {
      await page.route(ORGS_ROUTE, (route) =>
        route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(CREATE_RESPONSE),
        }),
      );

      await page.goto(NEW_ORG_URL);
      await page.getByLabel(/name/i).fill("Acme");
      await page
        .getByRole("button", { name: /create organization/i })
        .click();

      await expect(page).toHaveURL(new RegExp(`/org/${ORG_SLUG}$`));
    });

    test("member sees the scoped duel and the leaderboard on the org page", async ({ page }) => {
      await page.route(PAIR_ROUTE, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(ORG_PAIR),
        }),
      );
      await page.route(VOTE_ROUTE, (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            winner: { id: "ca", rating: 1520, rd: 340, score: 840 },
            loser: { id: "cb", rating: 1480, rd: 340, score: 800 },
          }),
        }),
      );

      await page.goto(ORG_PAGE_URL);

      await expect(
        page.getByRole("heading", { name: /leaderboard/i }),
      ).toBeVisible();
    });
  });
  ```
- [ ] **Step 3: Run the e2e spec and confirm it PASSES**
  Run: `npx playwright test e2e/org.spec.ts`
  Expected: PASS — 2 passing. (If this is the first Playwright run, `npx playwright install` may be required first; the scaffold phase configured `playwright.config.ts` with `webServer` pointing at `npm run dev`. The org page renders without a session: `canVote` is false and the leaderboard section heading is always present.)
- [ ] **Step 4: Commit**
  Run: `git add e2e/org.spec.ts && git commit -m "test(e2e): organizations — create org, view scoped feed + leaderboard"`
  Expected: one commit created.

---

### Task 17: Full-phase verification

**Files:**
- (no new files — verification only)

- [ ] **Step 1: Load skill superpowers:verification-before-completion and follow its best practices** — gather evidence before claiming done.
- [ ] **Step 2: Run the full unit/component suite**
  Run: `npx vitest run`
  Expected: PASS — all suites green, including `join-code`, `create-org`, `join-by-code`, `leave-org`, `orgs/route`, `cats/[id]/orgs/route`, `pick-pair.org-scope`, `vote/route.org-shared`, `org-create-form`, `org-leaderboard`, `org-feed`, and `org/[slug]/page.metadata`.
- [ ] **Step 3: Run the e2e suite**
  Run: `npx playwright test e2e/org.spec.ts`
  Expected: PASS — 2 passing.
- [ ] **Step 4: Lint, CSS-lint, and typecheck**
  Run: `npm run lint && npm run lint:css && npx tsc --noEmit`
  Expected: no errors from Biome, Stylelint, or tsc (kebab-case names, ordered imports, `import type`, named exports, no inline magic numbers).
- [ ] **Step 5: Final commit (only if any auto-fixes were applied)**
  Run: `git add -A && git commit -m "chore(org): lint/format pass for organizations phase"`
  Expected: a commit only if Biome/Stylelint changed files; otherwise nothing to commit.
