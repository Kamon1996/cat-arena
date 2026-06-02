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
    const forgedBody = Buffer.from(JSON.stringify({ ...payload, a: "cat-evil" })).toString(
      "base64url",
    );
    expect(verifyPairToken(`${forgedBody}.${sig}`)).toBeNull();
  });

  it("returns null for a malformed token", () => {
    expect(verifyPairToken("not-a-token")).toBeNull();
    expect(verifyPairToken("")).toBeNull();
  });
});
