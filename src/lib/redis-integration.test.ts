import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RATE_LIMIT_MAX_TOKENS } from "@/lib/constants";

// Integration test: exercises the REAL redis-driver code path (ioredis +
// rate-limiter-flexible) against a LIVE Redis — nothing is mocked except env,
// which is forced to the redis driver. Guarded by REDIS_IT=1 so the default
// `npm test` (no Redis in CI) stays green. Run with:
//   docker run -d -p 6379:6379 redis:7-alpine
//   REDIS_IT=1 npx vitest run src/lib/redis-integration.test.ts
const RUN = process.env.REDIS_IT === "1";
const REDIS_URL = process.env.TEST_REDIS_URL ?? "redis://localhost:6379";

vi.mock("@/lib/env", () => ({
  env: { REDIS_DRIVER: "redis", REDIS_URL },
}));

// Real implementations (no mocks for redis-client / ioredis / rate-limiter-flexible).
const { check } = await import("./rate-limit");
const { consumeNonce } = await import("./nonce-store");
const { getRedis } = await import("./redis-client");

function uniqueKey(label: string): string {
  return `it:${label}:${process.pid}:${Math.floor(Math.random() * 1e9)}`;
}

describe.runIf(RUN)("redis driver (live Redis)", () => {
  beforeEach(async () => {
    // Clean slate so prior runs don't leak rate-limit/nonce state.
    await getRedis().flushdb();
  });

  afterAll(async () => {
    await getRedis().quit();
  });

  it("consumeNonce: true on first claim, false on replay (SET NX)", async () => {
    const nonce = uniqueKey("nonce");
    expect(await consumeNonce(nonce)).toBe(true);
    expect(await consumeNonce(nonce)).toBe(false);
    expect(await consumeNonce(nonce)).toBe(false);
  });

  it("check: allows up to MAX_TOKENS then blocks (token bucket)", async () => {
    const key = uniqueKey("rl");
    for (let i = 0; i < RATE_LIMIT_MAX_TOKENS; i++) {
      const res = await check(key);
      expect(res.ok).toBe(true);
    }
    // Bucket now empty → next request is rejected.
    const blocked = await check(key);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("check: separate keys have independent buckets", async () => {
    const a = uniqueKey("rl-a");
    const b = uniqueKey("rl-b");
    // Exhaust A.
    for (let i = 0; i < RATE_LIMIT_MAX_TOKENS; i++) {
      await check(a);
    }
    expect((await check(a)).ok).toBe(false);
    // B is untouched.
    expect((await check(b)).ok).toBe(true);
  });
});
