# Pairing & Vote Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Build the duel-pairing selector, the HMAC single-use pair token, and the Upstash token-bucket rate limiter so the voting flow can pick fair pairs and reject self-made / replayed / abusive votes.
**Architecture:** Pairing splits into a pure, deterministic scoring/selection core (`pick-pair-core.ts`, seeded RNG, unit-tested with injected candidate arrays) and a thin Prisma query layer (`pick-pair.ts`) that fetches small candidate pools via the `(status, rd)` and `(status, score)` indexes and delegates ranking to the core. `pair-token.ts` is a pure Node `crypto` HMAC sign/verify (scope + nonce + short exp), and `rate-limit.ts` wraps `@upstash/ratelimit` token-bucket keyed by `voterKey`/IP.
**Tech Stack:** TypeScript · Prisma (Postgres/Neon) · `@upstash/ratelimit` + `@upstash/redis` · Node `crypto` (HMAC) · Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/pairing/pick-pair-core.ts` | Pure, DB-free candidate scoring & selection: weight A by `rd · 1/√(timesShown+1)`, pick B inside a score window excluding seen ids, ε-randomness via injected seeded RNG. |
| `src/pairing/pick-pair-core.test.ts` | Vitest unit tests for the pure core: A-weighting, B score-window, seen exclusion, ε-randomness, empty-pool → null (deterministic seed, injected arrays). |
| `src/pairing/pick-pair.ts` | DB query layer: implements `pickPair(opts)` per contract — pulls candidate pools (scope global/org) via Prisma indexes and delegates ranking to `pick-pair-core.ts`. |
| `src/pairing/pick-pair.test.ts` | Vitest tests for the DB layer with `prisma` mocked: scope routing, eligibility filter, null when pool too small. |
| `src/lib/constants.ts` | Add pairing + rate-limit + token named constants (extends existing §4 constants file). |
| `src/lib/pair-token.ts` | `signPairToken` / `verifyPairToken` — HMAC over canonical payload, base64url token, expiry check. |
| `src/lib/pair-token.test.ts` | Vitest: round-trip, tamper rejection, expiry rejection, malformed-input null. |
| `src/lib/rate-limit.ts` | `check(key)` — `@upstash/ratelimit` token-bucket, returns `{ ok, remaining }`. |
| `src/lib/rate-limit.test.ts` | Vitest: allowed / blocked / pending handled, with the Upstash limiter mocked. |

> Assumes earlier phases produced `prisma/schema.prisma` (§1), `src/lib/prisma.ts` (PrismaClient singleton), `src/lib/env.ts` (validated env), and the base `src/lib/constants.ts` (§4). This plan only adds the pairing/integrity modules and extends `constants.ts`.

---

### Task 1: Pairing constants + pure selection core

**Files:**
- Create: `src/pairing/pick-pair-core.ts`
- Create (test): `src/pairing/pick-pair-core.test.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices**
  Read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/web-testing-vitest/SKILL.md` and `examples/core.md`. Binding rules for this task: co-locate tests with code, named constants for ALL test data (no magic numbers), `vi.fn()` for mocks, v3+ option syntax `test("name", { ... }, () => {})`, named exports only, kebab-case filenames.

- [ ] **Step 2: Add pairing constants to `src/lib/constants.ts`**
  Append these named constants (the pure core and DB layer both import from here — no inline magic numbers anywhere):
  ```ts
  // Pairing — candidate pools & selection windows
  export const PAIR_A_CANDIDATE_POOL = 40;   // rows pulled via (status, rd) index for A
  export const PAIR_B_CANDIDATE_POOL = 40;   // rows pulled via (status, score) index for B
  export const PAIR_B_SCORE_WINDOW = 120;    // B.score must be within ±window of A.score
  export const PAIR_EPSILON = 0.15;          // prob. of picking a random eligible B instead of the closest
  export const PAIR_MIN_POOL = 2;            // need ≥2 distinct eligible cats to form a pair
  ```

- [ ] **Step 3: Write the failing test for the pure core (FULL code)**
  Create `src/pairing/pick-pair-core.test.ts`:
  ```ts
  import { describe, expect, it } from "vitest";

  import {
    PAIR_B_SCORE_WINDOW,
    PAIR_EPSILON,
  } from "@/lib/constants";
  import {
    pickPairCore,
    selectWeightedIndex,
    weightForA,
    type Candidate,
  } from "./pick-pair-core";

  const RATING_DEFAULT = 1500;

  // Deterministic RNG: returns the queued values in order, then repeats the last.
  function seededRng(values: number[]): () => number {
    let i = 0;
    return () => {
      const v = values[Math.min(i, values.length - 1)];
      i += 1;
      return v;
    };
  }

  function cat(
    id: string,
    score: number,
    rd: number,
    timesShown: number,
  ): Candidate {
    return { id, rating: RATING_DEFAULT, rd, score, timesShown };
  }

  describe("weightForA", () => {
    it("weights higher rd more heavily", () => {
      expect(weightForA(cat("x", 800, 350, 0))).toBeGreaterThan(
        weightForA(cat("y", 800, 100, 0)),
      );
    });

    it("weights low timesShown more heavily", () => {
      expect(weightForA(cat("fresh", 800, 200, 0))).toBeGreaterThan(
        weightForA(cat("shown", 800, 200, 99)),
      );
    });

    it("equals rd / sqrt(timesShown + 1)", () => {
      // rd 200, timesShown 3 => 200 / sqrt(4) = 100
      expect(weightForA(cat("c", 800, 200, 3))).toBeCloseTo(100, 5);
    });
  });

  describe("selectWeightedIndex", () => {
    it("returns -1 for empty weights", () => {
      expect(selectWeightedIndex([], seededRng([0.5]))).toBe(-1);
    });

    it("picks the bucket the random draw lands in", () => {
      // weights [1, 3] => total 4; rng 0.5 -> 2.0 lands in second bucket (>=1)
      expect(selectWeightedIndex([1, 3], seededRng([0.5]))).toBe(1);
      // rng 0.1 -> 0.4 lands in first bucket (<1)
      expect(selectWeightedIndex([1, 3], seededRng([0.1]))).toBe(0);
    });
  });

  describe("pickPairCore", () => {
    it("returns null when fewer than two eligible cats", () => {
      expect(
        pickPairCore({
          aPool: [cat("a", 800, 350, 0)],
          bPool: [],
          seenCatIds: [],
          rng: seededRng([0]),
        }),
      ).toBeNull();
    });

    it("excludes A itself and seen ids from B", () => {
      const result = pickPairCore({
        aPool: [cat("a", 800, 350, 0)],
        bPool: [
          cat("a", 800, 350, 0), // same as A — must be excluded
          cat("seen", 810, 90, 5), // seen — must be excluded
          cat("b", 820, 90, 5), // valid B
        ],
        seenCatIds: ["seen"],
        // rng[0] picks A (only one weight), rng[1] = 0.99 => no epsilon, pick closest
        rng: seededRng([0, 0.99]),
      });
      expect(result).not.toBeNull();
      expect(result?.a.id).toBe("a");
      expect(result?.b.id).toBe("b");
    });

    it("only picks B within the score window of A", () => {
      const aScore = 800;
      const result = pickPairCore({
        aPool: [cat("a", aScore, 350, 0)],
        bPool: [
          cat("far", aScore + PAIR_B_SCORE_WINDOW + 1, 90, 5), // out of window
          cat("near", aScore + 50, 90, 5), // in window
        ],
        seenCatIds: [],
        rng: seededRng([0, 0.99]),
      });
      expect(result?.b.id).toBe("near");
    });

    it("returns null when no B is inside the window", () => {
      const aScore = 800;
      const result = pickPairCore({
        aPool: [cat("a", aScore, 350, 0)],
        bPool: [cat("far", aScore + PAIR_B_SCORE_WINDOW + 1, 90, 5)],
        seenCatIds: [],
        rng: seededRng([0, 0.99]),
      });
      expect(result).toBeNull();
    });

    it("picks a random in-window B when epsilon roll hits", () => {
      const aScore = 800;
      // rng: [0]=A pick, [1]=epsilon roll (< PAIR_EPSILON => random branch),
      // [2]=index pick (0.99 -> last in-window candidate)
      const epsilonHit = PAIR_EPSILON / 2;
      const result = pickPairCore({
        aPool: [cat("a", aScore, 350, 0)],
        bPool: [
          cat("closest", aScore + 5, 90, 5),
          cat("further", aScore + 60, 90, 5),
        ],
        seenCatIds: [],
        rng: seededRng([0, epsilonHit, 0.99]),
      });
      expect(result?.b.id).toBe("further");
    });
  });
  ```

- [ ] **Step 3b: Run the test and expect FAIL**
  Command: `npx vitest run src/pairing/pick-pair-core.test.ts`
  Expected: FAIL with `Failed to resolve import "./pick-pair-core"` (module does not exist yet).

- [ ] **Step 4: Implement the pure core (FULL code)**
  Create `src/pairing/pick-pair-core.ts`:
  ```ts
  import {
    PAIR_B_SCORE_WINDOW,
    PAIR_EPSILON,
    PAIR_MIN_POOL,
  } from "@/lib/constants";

  const NOT_FOUND = -1;
  const TIMES_SHOWN_FLOOR = 1; // +1 so timesShown=0 does not divide by zero

  export type Candidate = {
    id: string;
    rating: number;
    rd: number;
    score: number;
    timesShown: number;
  };

  export type PickPairCoreInput = {
    aPool: Candidate[]; // candidates for A, drawn via (status, rd) index
    bPool: Candidate[]; // candidates for B, drawn via (status, score) index
    seenCatIds: string[]; // ids to exclude from B
    rng: () => number; // injected RNG in [0, 1) for deterministic tests
  };

  export type PickedPairCore = {
    a: Candidate;
    b: Candidate;
  };

  export { pickPairCore, selectWeightedIndex, weightForA };

  /** Selection weight for A: favors high rd and low timesShown. weight = rd / sqrt(timesShown + 1). */
  function weightForA(candidate: Candidate): number {
    return candidate.rd / Math.sqrt(candidate.timesShown + TIMES_SHOWN_FLOOR);
  }

  /** Pick an index proportional to weights using one rng draw. Returns -1 for empty input. */
  function selectWeightedIndex(weights: number[], rng: () => number): number {
    const total = weights.reduce((sum, w) => sum + w, 0);
    if (total <= 0) {
      return NOT_FOUND;
    }
    let target = rng() * total;
    for (let i = 0; i < weights.length; i += 1) {
      target -= weights[i];
      if (target < 0) {
        return i;
      }
    }
    return weights.length - 1;
  }

  /** Pure pair selection. Returns null when no valid pair can be formed. */
  function pickPairCore(input: PickPairCoreInput): PickedPairCore | null {
    const { aPool, bPool, seenCatIds, rng } = input;

    if (aPool.length === 0) {
      return null;
    }

    const aIndex = selectWeightedIndex(aPool.map(weightForA), rng);
    if (aIndex === NOT_FOUND) {
      return null;
    }
    const a = aPool[aIndex];

    const seen = new Set(seenCatIds);
    const eligibleB = bPool
      .filter(
        (c) =>
          c.id !== a.id &&
          !seen.has(c.id) &&
          Math.abs(c.score - a.score) <= PAIR_B_SCORE_WINDOW,
      )
      .sort(
        (x, y) =>
          Math.abs(x.score - a.score) - Math.abs(y.score - a.score),
      );

    if (eligibleB.length === 0) {
      return null;
    }

    if (aPool.length + eligibleB.length < PAIR_MIN_POOL) {
      return null;
    }

    const rollEpsilon = rng() < PAIR_EPSILON;
    let b: Candidate;
    if (rollEpsilon && eligibleB.length > 1) {
      const randomIndex = Math.floor(rng() * eligibleB.length);
      b = eligibleB[Math.min(randomIndex, eligibleB.length - 1)];
    } else {
      b = eligibleB[0]; // closest by score
    }

    return { a, b };
  }
  ```

- [ ] **Step 4b: Run the test and expect PASS**
  Command: `npx vitest run src/pairing/pick-pair-core.test.ts`
  Expected: PASS — all `weightForA`, `selectWeightedIndex`, and `pickPairCore` describe blocks green.

- [ ] **Step 5: Commit**
  `git add src/lib/constants.ts src/pairing/pick-pair-core.ts src/pairing/pick-pair-core.test.ts && git commit -m "feat(pairing): pure candidate scoring & selection core"`

---

### Task 2: DB query layer — `pickPair`

**Files:**
- Create: `src/pairing/pick-pair.ts`
- Create (test): `src/pairing/pick-pair.test.ts`

- [ ] **Step 1: Load skill api-database-prisma and follow its best practices**
  Read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-prisma/SKILL.md`. Binding rules for this task: use the `prisma` singleton from `@/lib/prisma`, never construct `PrismaClient` here; query small candidate pools via the `(status, score)` and `(status, rd)` indexes with `take` (never a full-table sort); eligibility = `status = ACTIVE` AND `images: { some: { status: APPROVED } }`.

- [ ] **Step 2: Write the failing test for the DB layer (FULL code)**
  Create `src/pairing/pick-pair.test.ts`. Network-level mocking does not apply to Prisma, so mock the singleton module with `vi.mock`:
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  vi.mock("@/lib/prisma", () => ({
    prisma: {
      cat: {
        findMany: vi.fn(),
      },
    },
  }));

  import { prisma } from "@/lib/prisma";
  import { pickPair } from "./pick-pair";

  const VOTER_KEY = "anon-123";
  const A_ROW = {
    id: "a",
    rating: 1500,
    rd: 350,
    score: 800,
    timesShown: 0,
  };
  const B_NEAR = {
    id: "b",
    rating: 1500,
    rd: 90,
    score: 820,
    timesShown: 5,
  };
  const B_SELF = { ...A_ROW };

  const findMany = vi.mocked(prisma.cat.findMany);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("pickPair (global scope)", () => {
    it("queries ACTIVE cats with an APPROVED image and returns a pair", async () => {
      // First call: A-pool (status, rd). Second call: B-pool (status, score).
      findMany
        .mockResolvedValueOnce([A_ROW] as never)
        .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

      const result = await pickPair({
        scope: "global",
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });

      expect(result).not.toBeNull();
      expect(result?.a.id).toBe("a");
      expect(result?.b.id).toBe("b");

      // Eligibility filter present on the A-pool query.
      const aArgs = findMany.mock.calls[0][0];
      expect(aArgs.where.status).toBe("ACTIVE");
      expect(aArgs.where.images.some.status).toBe("APPROVED");
    });

    it("returns null when no eligible candidates", async () => {
      findMany.mockResolvedValue([] as never);
      const result = await pickPair({
        scope: "global",
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });
      expect(result).toBeNull();
    });

    it("excludes self and seen from B", async () => {
      findMany
        .mockResolvedValueOnce([A_ROW] as never)
        .mockResolvedValueOnce([B_SELF, B_NEAR] as never);

      const result = await pickPair({
        scope: "global",
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });
      expect(result?.b.id).toBe("b"); // self excluded by core
    });
  });

  describe("pickPair (org scope)", () => {
    it("restricts the pool to org members", async () => {
      findMany
        .mockResolvedValueOnce([A_ROW] as never)
        .mockResolvedValueOnce([A_ROW, B_NEAR] as never);

      await pickPair({
        scope: { orgId: "org-1" },
        seenCatIds: [],
        voterKey: VOTER_KEY,
      });

      const aArgs = findMany.mock.calls[0][0];
      expect(aArgs.where.orgs.some.orgId).toBe("org-1");
    });
  });
  ```

- [ ] **Step 2b: Run the test and expect FAIL**
  Command: `npx vitest run src/pairing/pick-pair.test.ts`
  Expected: FAIL with `Failed to resolve import "./pick-pair"` (module does not exist yet).

- [ ] **Step 3: Implement the DB query layer (FULL code)**
  Create `src/pairing/pick-pair.ts`. Signature matches the contract verbatim:
  ```ts
  import type { Cat } from "@prisma/client";

  import {
    PAIR_A_CANDIDATE_POOL,
    PAIR_B_CANDIDATE_POOL,
    PAIR_B_SCORE_WINDOW,
  } from "@/lib/constants";
  import { prisma } from "@/lib/prisma";

  import { pickPairCore, type Candidate } from "./pick-pair-core";

  const CAT_ACTIVE = "ACTIVE" as const;
  const IMAGE_APPROVED = "APPROVED" as const;

  export type PairScope = "global" | { orgId: string };

  export type PickPairOptions = {
    scope: PairScope;
    seenCatIds: string[];
    voterKey: string;
  };

  export type PickedPair = {
    a: Pick<Cat, "id" | "rating" | "rd" | "score" | "timesShown">;
    b: Pick<Cat, "id" | "rating" | "rd" | "score" | "timesShown">;
  };

  export { pickPair };

  const CANDIDATE_SELECT = {
    id: true,
    rating: true,
    rd: true,
    score: true,
    timesShown: true,
  } as const;

  function eligibilityWhere(scope: PairScope) {
    const base = {
      status: CAT_ACTIVE,
      images: { some: { status: IMAGE_APPROVED } },
    };
    if (scope === "global") {
      return base;
    }
    return { ...base, orgs: { some: { orgId: scope.orgId } } };
  }

  async function pickPair(opts: PickPairOptions): Promise<PickedPair | null> {
    const where = eligibilityWhere(opts.scope);

    // A-pool: small set with highest rd via the (status, rd) index — never full-table.
    const aPool = (await prisma.cat.findMany({
      where,
      select: CANDIDATE_SELECT,
      orderBy: { rd: "desc" },
      take: PAIR_A_CANDIDATE_POOL,
    })) as Candidate[];

    if (aPool.length === 0) {
      return null;
    }

    const anchor = aPool[0];

    // B-pool: cats whose score is within ±window of the strongest A candidate,
    // via the (status, score) index. Core re-anchors to the actually chosen A.
    const bPool = (await prisma.cat.findMany({
      where: {
        ...where,
        score: {
          gte: anchor.score - PAIR_B_SCORE_WINDOW,
          lte: anchor.score + PAIR_B_SCORE_WINDOW,
        },
      },
      select: CANDIDATE_SELECT,
      orderBy: { score: "asc" },
      take: PAIR_B_CANDIDATE_POOL,
    })) as Candidate[];

    return pickPairCore({
      aPool,
      bPool,
      seenCatIds: opts.seenCatIds,
      rng: Math.random,
    });
  }
  ```

- [ ] **Step 3b: Run the test and expect PASS**
  Command: `npx vitest run src/pairing/pick-pair.test.ts`
  Expected: PASS — global + org scope blocks green.

- [ ] **Step 4: Commit**
  `git add src/pairing/pick-pair.ts src/pairing/pick-pair.test.ts && git commit -m "feat(pairing): prisma candidate-pool query layer for pickPair"`

---

### Task 3: HMAC pair token — sign & verify

**Files:**
- Create: `src/lib/pair-token.ts`
- Create (test): `src/lib/pair-token.test.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Load skill web-testing-vitest and follow its best practices**
  Already read in Task 1 — re-confirm: named constants for all test data, `test`/`it` option object is the 2nd arg, `vi.useFakeTimers()` for time control, reset timers in `afterEach`. No new tech area beyond Vitest + Node `crypto` (no vendored skill for `crypto`; follow Node best practice: `createHmac`, `timingSafeEqual`, base64url).

- [ ] **Step 2: Add token constant to `src/lib/constants.ts`**
  Append:
  ```ts
  // Pair token — single-use HMAC token lifetime
  export const PAIR_TOKEN_TTL_SECONDS = 120; // short expiry; nonce gives single-use
  ```

- [ ] **Step 3: Write the failing test (FULL code)**
  Create `src/lib/pair-token.test.ts`:
  ```ts
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

  import { PAIR_TOKEN_TTL_SECONDS } from "@/lib/constants";
  import { signPairToken, verifyPairToken } from "./pair-token";

  const PAYLOAD = {
    a: "cat-a",
    b: "cat-b",
    nonce: "nonce-xyz",
    exp: 0, // set per-test relative to mocked clock
    scope: "global",
  };

  const FIXED_NOW_MS = 1_700_000_000_000;
  const MS_PER_SECOND = 1000;

  beforeEach(() => {
    vi.stubEnv("PAIR_TOKEN_SECRET", "test-secret-please-change");
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  function nowSeconds(): number {
    return Math.floor(FIXED_NOW_MS / MS_PER_SECOND);
  }

  describe("pair token round-trip", () => {
    it("verifies a freshly signed, unexpired token", () => {
      const payload = { ...PAYLOAD, exp: nowSeconds() + PAIR_TOKEN_TTL_SECONDS };
      const token = signPairToken(payload);
      expect(verifyPairToken(token)).toEqual(payload);
    });

    it("preserves the scope field", () => {
      const payload = {
        ...PAYLOAD,
        scope: "org:org-1",
        exp: nowSeconds() + PAIR_TOKEN_TTL_SECONDS,
      };
      expect(verifyPairToken(signPairToken(payload))?.scope).toBe("org:org-1");
    });
  });

  describe("pair token rejection", () => {
    it("returns null for an expired token", () => {
      const payload = { ...PAYLOAD, exp: nowSeconds() - 1 };
      expect(verifyPairToken(signPairToken(payload))).toBeNull();
    });

    it("returns null when the signature is tampered", () => {
      const payload = { ...PAYLOAD, exp: nowSeconds() + PAIR_TOKEN_TTL_SECONDS };
      const token = signPairToken(payload);
      const [body] = token.split(".");
      const forged = `${body}.deadbeefdeadbeef`;
      expect(verifyPairToken(forged)).toBeNull();
    });

    it("returns null when the payload is tampered", () => {
      const payload = { ...PAYLOAD, exp: nowSeconds() + PAIR_TOKEN_TTL_SECONDS };
      const token = signPairToken(payload);
      const [, sig] = token.split(".");
      const forgedBody = Buffer.from(
        JSON.stringify({ ...payload, a: "cat-evil" }),
      ).toString("base64url");
      expect(verifyPairToken(`${forgedBody}.${sig}`)).toBeNull();
    });

    it("returns null for a malformed token", () => {
      expect(verifyPairToken("not-a-token")).toBeNull();
      expect(verifyPairToken("")).toBeNull();
    });
  });
  ```

- [ ] **Step 3b: Run the test and expect FAIL**
  Command: `npx vitest run src/lib/pair-token.test.ts`
  Expected: FAIL with `Failed to resolve import "./pair-token"` (module does not exist yet).

- [ ] **Step 4: Implement the token module (FULL code)**
  Create `src/lib/pair-token.ts`. Token format is `base64url(payloadJSON).base64url(hmac)`. Verify uses constant-time comparison and re-derives the expected signature:
  ```ts
  import { createHmac, timingSafeEqual } from "node:crypto";

  const MS_PER_SECOND = 1000;
  const TOKEN_PART_COUNT = 2;
  const HMAC_ALGORITHM = "sha256";

  export type PairTokenPayload = {
    a: string;
    b: string;
    nonce: string;
    exp: number;
    scope: string;
  };

  export { signPairToken, verifyPairToken };

  function secret(): string {
    const value = process.env.PAIR_TOKEN_SECRET;
    if (!value) {
      throw new Error("PAIR_TOKEN_SECRET is not set");
    }
    return value;
  }

  function sign(body: string): string {
    return createHmac(HMAC_ALGORITHM, secret()).update(body).digest("base64url");
  }

  function signPairToken(payload: PairTokenPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${body}.${sign(body)}`;
  }

  function safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      return false;
    }
    return timingSafeEqual(bufA, bufB);
  }

  function verifyPairToken(token: string): PairTokenPayload | null {
    const parts = token.split(".");
    if (parts.length !== TOKEN_PART_COUNT) {
      return null;
    }
    const [body, signature] = parts;
    if (!body || !signature) {
      return null;
    }
    if (!safeEqual(signature, sign(body))) {
      return null;
    }

    let payload: PairTokenPayload;
    try {
      payload = JSON.parse(
        Buffer.from(body, "base64url").toString("utf8"),
      ) as PairTokenPayload;
    } catch {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / MS_PER_SECOND);
    if (typeof payload.exp !== "number" || payload.exp < nowSeconds) {
      return null;
    }

    return payload;
  }
  ```

- [ ] **Step 4b: Run the test and expect PASS**
  Command: `npx vitest run src/lib/pair-token.test.ts`
  Expected: PASS — round-trip + all rejection cases green.

- [ ] **Step 5: Commit**
  `git add src/lib/constants.ts src/lib/pair-token.ts src/lib/pair-token.test.ts && git commit -m "feat(integrity): HMAC single-use pair token sign/verify"`

---

### Task 4: Upstash token-bucket rate limiter — `check`

**Files:**
- Create: `src/lib/rate-limit.ts`
- Create (test): `src/lib/rate-limit.test.ts`
- Modify: `src/lib/constants.ts`

- [ ] **Step 1: Load skill api-database-upstash and follow its best practices**
  Read `/Users/dmitrykalganov/Desktop/cat-arena/.claude/skills/api-database-upstash/SKILL.md` and `examples/rate-limiting.md`. Binding rules for this task: use `Redis.fromEnv()` (never hardcode `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`); use `Ratelimit.tokenBucket(refillRate, interval, maxTokens)` per the contract ("token-bucket"); reuse a module-level limiter singleton (one per import, not per call); named constants for all limits; do NOT use Pub/Sub or Lua. The `pending` promise is awaited here (Node runtime, not edge) so analytics are not dropped.

- [ ] **Step 2: Add rate-limit constants to `src/lib/constants.ts`**
  Append:
  ```ts
  // Rate limiting — vote token bucket (per voterKey/IP)
  export const RATE_LIMIT_REFILL_TOKENS = 10; // tokens added per interval
  export const RATE_LIMIT_REFILL_INTERVAL = "10 s"; // refill cadence
  export const RATE_LIMIT_MAX_TOKENS = 20; // bucket capacity (allows a short burst)
  export const RATE_LIMIT_PREFIX = "ratelimit:vote";
  ```

- [ ] **Step 3: Write the failing test (FULL code)**
  Create `src/lib/rate-limit.test.ts`. Mock the `@upstash/ratelimit` and `@upstash/redis` modules so no network is touched:
  ```ts
  import { beforeEach, describe, expect, it, vi } from "vitest";

  const limitMock = vi.fn();

  vi.mock("@upstash/redis", () => ({
    Redis: { fromEnv: vi.fn(() => ({})) },
  }));

  vi.mock("@upstash/ratelimit", () => ({
    Ratelimit: Object.assign(
      vi.fn(() => ({ limit: limitMock })),
      { tokenBucket: vi.fn(() => ({})) },
    ),
  }));

  import { check } from "./rate-limit";

  const VOTER_KEY = "anon-abc";
  const REMAINING_OK = 7;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("check", () => {
    it("returns ok:true with remaining when under the limit", async () => {
      limitMock.mockResolvedValue({
        success: true,
        remaining: REMAINING_OK,
        pending: Promise.resolve(),
      });

      const result = await check(VOTER_KEY);
      expect(result).toEqual({ ok: true, remaining: REMAINING_OK });
      expect(limitMock).toHaveBeenCalledWith(VOTER_KEY);
    });

    it("returns ok:false with remaining 0 when over the limit", async () => {
      limitMock.mockResolvedValue({
        success: false,
        remaining: 0,
        pending: Promise.resolve(),
      });

      const result = await check(VOTER_KEY);
      expect(result).toEqual({ ok: false, remaining: 0 });
    });
  });
  ```

- [ ] **Step 3b: Run the test and expect FAIL**
  Command: `npx vitest run src/lib/rate-limit.test.ts`
  Expected: FAIL with `Failed to resolve import "./rate-limit"` (module does not exist yet).

- [ ] **Step 4: Implement the rate limiter (FULL code)**
  Create `src/lib/rate-limit.ts`. Module-level limiter singleton, token-bucket, `pending` awaited (Node runtime):
  ```ts
  import { Ratelimit } from "@upstash/ratelimit";
  import { Redis } from "@upstash/redis";

  import {
    RATE_LIMIT_MAX_TOKENS,
    RATE_LIMIT_PREFIX,
    RATE_LIMIT_REFILL_INTERVAL,
    RATE_LIMIT_REFILL_TOKENS,
  } from "@/lib/constants";

  export type RateLimitResult = {
    ok: boolean;
    remaining: number;
  };

  export { check };

  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.tokenBucket(
      RATE_LIMIT_REFILL_TOKENS,
      RATE_LIMIT_REFILL_INTERVAL,
      RATE_LIMIT_MAX_TOKENS,
    ),
    analytics: true,
    prefix: RATE_LIMIT_PREFIX,
  });

  async function check(key: string): Promise<RateLimitResult> {
    const { success, remaining, pending } = await ratelimit.limit(key);
    // Node runtime: await pending so analytics are not dropped (no edge waitUntil).
    await pending;
    return { ok: success, remaining };
  }
  ```

- [ ] **Step 4b: Run the test and expect PASS**
  Command: `npx vitest run src/lib/rate-limit.test.ts`
  Expected: PASS — allowed + blocked cases green.

- [ ] **Step 5: Commit**
  `git add src/lib/constants.ts src/lib/rate-limit.ts src/lib/rate-limit.test.ts && git commit -m "feat(integrity): upstash token-bucket vote rate limiter"`

---

### Task 5: Full-suite verification & typecheck

**Files:**
- Test (run only): all four new test files + project typecheck

- [ ] **Step 1: Run the full pairing + integrity suite**
  Command: `npx vitest run src/pairing src/lib/pair-token.test.ts src/lib/rate-limit.test.ts`
  Expected: PASS — 4 test files, all describe blocks green, zero failures.

- [ ] **Step 2: Typecheck the new modules**
  Command: `npm run typecheck`
  Expected: exit code 0, no errors. Confirms the contract signatures (`pickPair`, `signPairToken`, `verifyPairToken`, `check`, `RateLimitResult`, `PairTokenPayload`) compile against `@prisma/client` types and `@/lib/*` imports.

- [ ] **Step 3: Lint the new files**
  Command: `npm run lint`
  Expected: Biome reports no errors for the new files (kebab-case names, ordered imports, `import type`, named exports, no inline magic numbers).

- [ ] **Step 4: Commit (only if lint/typecheck applied autofixes)**
  `git add -A && git commit -m "chore(pairing): lint & typecheck pass for pairing + integrity modules"`
