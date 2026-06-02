import { z } from "zod";

const MIN_SECRET_LENGTH = 16;

export const envSchema = z.object({
  // Postgres (Neon) — pooled at runtime, direct for migrations
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  // Auth.js v5
  AUTH_SECRET: z.string().min(MIN_SECRET_LENGTH),
  AUTH_URL: z.url(),
  // Resend magic-link email
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.email(),
  // Cloudflare R2 (S3 API)
  R2_ACCOUNT_ID: z.string().min(1),
  // R2 API credentials are provisioned in phase 06; allow empty until then so the
  // validated env loads for phases 02–05 (tighten back to .min(1) once R2 is wired).
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: z.url(),
  // Upstash Redis (rate limiting)
  UPSTASH_REDIS_REST_URL: z.url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
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
});

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
