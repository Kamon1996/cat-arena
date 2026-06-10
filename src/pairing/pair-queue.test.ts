import { describe, expect, it } from "vitest";

import type { PairResponse } from "@/lib/api-types";
import { appendPairs, pruneExpired, refillCount } from "./pair-queue";

const NOW_MS = 1_700_000_000_000;
const ONE_MINUTE_MS = 60_000;
const BOUNDS = { min: 2, target: 5 };

function pairAt(token: string, expiresAt: number): PairResponse {
  return {
    token,
    expiresAt,
    a: { id: `${token}-a`, name: "A", slug: `${token}-a`, images: [] },
    b: { id: `${token}-b`, name: "B", slug: `${token}-b`, images: [] },
  };
}

describe("pruneExpired", () => {
  it("keeps pairs that expire in the future", () => {
    const fresh = pairAt("fresh", NOW_MS + ONE_MINUTE_MS);
    expect(pruneExpired([fresh], NOW_MS)).toEqual([fresh]);
  });

  it("drops pairs at or past their expiry", () => {
    const expired = pairAt("expired", NOW_MS - ONE_MINUTE_MS);
    const atBoundary = pairAt("boundary", NOW_MS);
    const fresh = pairAt("fresh", NOW_MS + ONE_MINUTE_MS);
    expect(pruneExpired([expired, atBoundary, fresh], NOW_MS)).toEqual([fresh]);
  });

  it("returns an empty list unchanged", () => {
    expect(pruneExpired([], NOW_MS)).toEqual([]);
  });
});

describe("refillCount", () => {
  it("requests a full batch for an empty queue", () => {
    expect(refillCount(0, BOUNDS)).toBe(BOUNDS.target);
  });

  it("tops up to target at the watermark", () => {
    expect(refillCount(BOUNDS.min, BOUNDS)).toBe(BOUNDS.target - BOUNDS.min);
  });

  it("does nothing above the watermark", () => {
    expect(refillCount(BOUNDS.min + 1, BOUNDS)).toBe(0);
    expect(refillCount(BOUNDS.target, BOUNDS)).toBe(0);
  });

  it("never goes negative when the queue exceeds the target", () => {
    expect(refillCount(BOUNDS.target + 1, { ...BOUNDS, min: BOUNDS.target + 2 })).toBe(0);
  });
});

describe("appendPairs", () => {
  it("appends incoming pairs after the existing queue", () => {
    const first = pairAt("first", NOW_MS + ONE_MINUTE_MS);
    const second = pairAt("second", NOW_MS + ONE_MINUTE_MS);
    expect(appendPairs([first], [second])).toEqual([first, second]);
  });

  it("drops incoming pairs whose token is already queued", () => {
    const first = pairAt("first", NOW_MS + ONE_MINUTE_MS);
    const duplicate = pairAt("first", NOW_MS + ONE_MINUTE_MS);
    const second = pairAt("second", NOW_MS + ONE_MINUTE_MS);
    expect(appendPairs([first], [duplicate, second])).toEqual([first, second]);
  });
});
