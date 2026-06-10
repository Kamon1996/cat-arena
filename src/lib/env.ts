import { z } from "zod";

const MIN_SECRET_LENGTH = 16;

export const envSchema = z.object({
  // Postgres (Neon) — pooled at runtime, direct for migrations
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  // Auth.js v5
  AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  AUTH_URL: z.url(),
  // Google OAuth (active sign-in method) — auto-detected by Auth.js, validated here too.
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
  // Resend magic-link email — STASHED (Google OAuth is active); optional until re-enabled.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.email().optional(),
  // Object storage (S3 API). Defaults target Cloudflare R2; override S3_ENDPOINT/
  // S3_REGION/S3_FORCE_PATH_STYLE to point at any S3-compatible provider
  // (Selectel/Yandex/MinIO) on migration — no code change, just env.
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
  // Full S3 endpoint URL. Optional: if unset, derived from R2_ACCOUNT_ID (R2).
  S3_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().min(1).default("auto"), // R2="auto"; Selectel/Yandex="ru-1" etc.
  S3_FORCE_PATH_STYLE: z.stringbool().default(false), // many non-R2 providers need true
  // Redis (vote rate-limit + pair-token nonce). Two interchangeable drivers:
  //   "upstash" → serverless HTTP client (Vercel, current prod) via UPSTASH_REDIS_REST_*
  //   "redis"   → standard TCP client (ioredis) for a persistent VPS, via REDIS_URL
  // The exact-one-of requirement is enforced in checkRedisConfig() below.
  REDIS_DRIVER: z.enum(["upstash", "redis"]).default("upstash"),
  REDIS_URL: z.string().min(1).optional(), // redis:// or rediss://  (driver=redis)
  UPSTASH_REDIS_REST_URL: z.url().optional(), //                     (driver=upstash)
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  // Pair-token HMAC
  PAIR_TOKEN_SECRET: z.string().min(MIN_SECRET_LENGTH),
  // Cloudflare Workers AI (NSFW / is-it-a-cat)
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  // PostHog (client analytics)
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
  NEXT_PUBLIC_POSTHOG_HOST: z.url(),
  // Sentry (errors / perf)
  SENTRY_DSN: z.url(),
  // Cron auth: shared secret for /api/cron/* (Bearer token). Optional — if unset,
  // the cron endpoints are disabled (return 503) rather than running unauthenticated.
  CRON_SECRET: z.string().min(MIN_SECRET_LENGTH).optional(),
});

/**
 * The Redis driver gates which credentials are mandatory: "upstash" needs the
 * REST URL+token, "redis" needs a connection URL. Zod can't express this cleanly
 * inline, so validate the active driver's requirements after the base parse.
 */
function checkRedisConfig(value: Env): void {
  if (value.REDIS_DRIVER === "redis") {
    if (!value.REDIS_URL) {
      throw new Error("REDIS_DRIVER=redis requires REDIS_URL");
    }
    return;
  }
  if (!value.UPSTASH_REDIS_REST_URL || !value.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "REDIS_DRIVER=upstash requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
    );
  }
}

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

function loadEnv(): Env {
  if (cached) {
    return cached;
  }
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  checkRedisConfig(parsed.data);
  cached = parsed.data;
  return cached;
}

// Validated, typed env access. Validation is lazy: it runs on first property
// access (hard-failing on invalid/missing config — a deploy error, not user
// input), not at import time. This keeps merely importing the module (or its
// schema) side-effect free for tests and the build.
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    return loadEnv()[key as keyof Env];
  },
}) satisfies Env;
