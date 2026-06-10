import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so mocks are initialized before the hoisted vi.mock factories run.
// `state.driver` is mutable so each test can flip REDIS_DRIVER and exercise the
// branch in check() (which reads env.REDIS_DRIVER on every call).
const { state, mockLimit, mockConsume } = vi.hoisted(() => ({
  state: { driver: "upstash" as "upstash" | "redis" },
  mockLimit: vi.fn(),
  mockConsume: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    get REDIS_DRIVER() {
      return state.driver;
    },
  },
}));

vi.mock("@/lib/redis-client", () => ({ getRedis: vi.fn(() => ({})) }));

vi.mock("rate-limiter-flexible", () => ({
  RateLimiterRedis: vi.fn(function MockRateLimiterRedis() {
    return { consume: mockConsume };
  }),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({})) },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn(function MockRatelimit() {
      return { limit: mockLimit };
    }),
    { tokenBucket: vi.fn(() => ({})), fixedWindow: vi.fn(() => ({})) },
  ),
}));

import { Ratelimit } from "@upstash/ratelimit";

import {
  RATE_LIMIT_PAIR_PREFIX,
  RATE_LIMIT_UPLOAD_DAILY_PREFIX,
  RATE_LIMIT_UPLOAD_PREFIX,
} from "@/lib/constants";
import { check, checkPairServe, checkUploadBurst, checkUploadDaily } from "./rate-limit";

const VOTER_KEY = "anon-abc";
const USER_KEY = "user_1";
const REMAINING_OK = 7;

beforeEach(() => {
  vi.clearAllMocks();
  state.driver = "upstash";
});

describe("check — Upstash driver", () => {
  it("returns ok:true with remaining when under the limit", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      remaining: REMAINING_OK,
      pending: Promise.resolve(),
    });

    const result = await check(VOTER_KEY);
    expect(result).toEqual({ ok: true, remaining: REMAINING_OK });
    expect(mockLimit).toHaveBeenCalledWith(VOTER_KEY);
  });

  it("returns ok:false with remaining 0 when over the limit", async () => {
    mockLimit.mockResolvedValue({
      success: false,
      remaining: 0,
      pending: Promise.resolve(),
    });

    const result = await check(VOTER_KEY);
    expect(result).toEqual({ ok: false, remaining: 0 });
  });
});

describe("check — Redis driver", () => {
  beforeEach(() => {
    state.driver = "redis";
  });

  it("returns ok:true with remaining when consume succeeds", async () => {
    mockConsume.mockResolvedValue({ remainingPoints: REMAINING_OK });

    const result = await check(VOTER_KEY);
    expect(result).toEqual({ ok: true, remaining: REMAINING_OK });
    expect(mockConsume).toHaveBeenCalledWith(VOTER_KEY, 1);
    // Upstash path must NOT be touched under the redis driver.
    expect(mockLimit).not.toHaveBeenCalled();
  });

  it("returns ok:false when consume rejects with a RateLimiterRes (over limit)", async () => {
    // rate-limiter-flexible rejects with a plain result object (NOT an Error).
    mockConsume.mockRejectedValue({ remainingPoints: 0, msBeforeNext: 5000 });

    const result = await check(VOTER_KEY);
    expect(result).toEqual({ ok: false, remaining: 0 });
  });

  it("rethrows when consume rejects with a real Error (Redis down)", async () => {
    mockConsume.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(check(VOTER_KEY)).rejects.toThrow("ECONNREFUSED");
  });
});

describe("named window limiters", () => {
  // MUST run first in this describe: Upstash limiter instances are cached per
  // prefix at module level, so the constructor (whose call args carry the
  // prefix) only fires the first time each named check is used.
  it("each limiter is namespaced by its own redis prefix", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      remaining: REMAINING_OK,
      pending: Promise.resolve(),
    });

    await checkUploadBurst(USER_KEY);
    await checkUploadDaily(USER_KEY);
    await checkPairServe(VOTER_KEY);

    const prefixes = vi
      .mocked(Ratelimit)
      .mock.calls.map((call) => (call[0] as { prefix?: string }).prefix);
    expect(prefixes).toEqual(
      expect.arrayContaining([
        RATE_LIMIT_UPLOAD_PREFIX,
        RATE_LIMIT_UPLOAD_DAILY_PREFIX,
        RATE_LIMIT_PAIR_PREFIX,
      ]),
    );
  });

  it("checkUploadBurst maps an Upstash success to ok:true", async () => {
    mockLimit.mockResolvedValue({
      success: true,
      remaining: REMAINING_OK,
      pending: Promise.resolve(),
    });

    const result = await checkUploadBurst(USER_KEY);
    expect(result).toEqual({ ok: true, remaining: REMAINING_OK });
    expect(mockLimit).toHaveBeenCalledWith(USER_KEY);
  });

  it("checkUploadDaily maps an Upstash over-limit to ok:false", async () => {
    mockLimit.mockResolvedValue({ success: false, remaining: 0, pending: Promise.resolve() });

    const result = await checkUploadDaily(USER_KEY);
    expect(result).toEqual({ ok: false, remaining: 0 });
  });

  it("checkPairServe consumes from rate-limiter-flexible under the redis driver", async () => {
    state.driver = "redis";
    mockConsume.mockResolvedValue({ remainingPoints: REMAINING_OK });

    const result = await checkPairServe(VOTER_KEY);
    expect(result).toEqual({ ok: true, remaining: REMAINING_OK });
    expect(mockConsume).toHaveBeenCalledWith(VOTER_KEY, 1);
    expect(mockLimit).not.toHaveBeenCalled();
  });
});
