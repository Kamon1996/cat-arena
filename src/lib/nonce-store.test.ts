import { beforeEach, describe, expect, it, vi } from "vitest";

const { state, mockUpstashSet, mockRedisSet } = vi.hoisted(() => ({
  state: { driver: "upstash" as "upstash" | "redis" },
  mockUpstashSet: vi.fn(),
  mockRedisSet: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    get REDIS_DRIVER() {
      return state.driver;
    },
    UPSTASH_REDIS_REST_URL: "https://x.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "tok",
  },
}));

vi.mock("@/lib/redis-client", () => ({ getRedis: vi.fn(() => ({ set: mockRedisSet })) }));

vi.mock("@upstash/redis", () => ({
  Redis: vi.fn(function MockRedis() {
    return { set: mockUpstashSet };
  }),
}));

import { consumeNonce } from "./nonce-store";

const NONCE = "nonce-xyz";

beforeEach(() => {
  vi.clearAllMocks();
  state.driver = "upstash";
});

describe("consumeNonce — Upstash driver", () => {
  it("returns true the first time (SET NX succeeds → 'OK')", async () => {
    mockUpstashSet.mockResolvedValue("OK");
    expect(await consumeNonce(NONCE)).toBe(true);
    expect(mockUpstashSet).toHaveBeenCalledWith("nonce:nonce-xyz", "1", {
      nx: true,
      ex: expect.any(Number),
    });
  });

  it("returns false on replay (SET NX returns null)", async () => {
    mockUpstashSet.mockResolvedValue(null);
    expect(await consumeNonce(NONCE)).toBe(false);
  });
});

describe("consumeNonce — Redis driver", () => {
  beforeEach(() => {
    state.driver = "redis";
  });

  it("returns true the first time (SET ... NX → 'OK')", async () => {
    mockRedisSet.mockResolvedValue("OK");
    expect(await consumeNonce(NONCE)).toBe(true);
    expect(mockRedisSet).toHaveBeenCalledWith(
      "nonce:nonce-xyz",
      "1",
      "EX",
      expect.any(Number),
      "NX",
    );
    expect(mockUpstashSet).not.toHaveBeenCalled();
  });

  it("returns false on replay (SET ... NX → null)", async () => {
    mockRedisSet.mockResolvedValue(null);
    expect(await consumeNonce(NONCE)).toBe(false);
  });
});
