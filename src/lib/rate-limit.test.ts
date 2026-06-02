import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted so the limiter mock is initialized before the hoisted vi.mock factory runs.
const { mockLimit } = vi.hoisted(() => ({ mockLimit: vi.fn() }));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: vi.fn(() => ({})) },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    vi.fn(function MockRatelimit() {
      return { limit: mockLimit };
    }),
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
