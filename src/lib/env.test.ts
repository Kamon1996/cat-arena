import { describe, expect, it } from "vitest";

import { envSchema } from "./env";

const VALID_RAW = {
  DATABASE_URL: "postgresql://u:p@host/db?pgbouncer=true",
  DIRECT_URL: "postgresql://u:p@host/db",
  AUTH_SECRET: "super-secret-value-1234567890",
  AUTH_URL: "https://cat-arena.example.com",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "cats@cat-arena.example.com",
  R2_ACCOUNT_ID: "acct_123",
  R2_ACCESS_KEY_ID: "ak_123",
  R2_SECRET_ACCESS_KEY: "sk_123",
  R2_BUCKET: "cat-arena",
  R2_PUBLIC_URL: "https://cdn.cat-arena.example.com",
  UPSTASH_REDIS_REST_URL: "https://redis.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "upstash_token",
  PAIR_TOKEN_SECRET: "pair-token-secret-1234567890",
  CLOUDFLARE_ACCOUNT_ID: "cf_acct_123",
  CLOUDFLARE_API_TOKEN: "cf_token_123",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_test",
  NEXT_PUBLIC_POSTHOG_HOST: "https://us.i.posthog.com",
  SENTRY_DSN: "https://abc@o0.ingest.sentry.io/0",
};

describe("envSchema", () => {
  it("accepts a complete, well-formed environment", () => {
    const result = envSchema.safeParse(VALID_RAW);
    expect(result.success).toBe(true);
  });

  it("rejects a missing required server secret", () => {
    const { AUTH_SECRET, ...missing } = VALID_RAW;
    const result = envSchema.safeParse(missing);
    expect(result.success).toBe(false);
  });

  it("rejects a malformed URL field", () => {
    const result = envSchema.safeParse({ ...VALID_RAW, R2_PUBLIC_URL: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects empty R2 API credentials", () => {
    const result = envSchema.safeParse({
      ...VALID_RAW,
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    });
    expect(result.success).toBe(false);
  });
});
