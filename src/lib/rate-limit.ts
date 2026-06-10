import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RateLimiterRedis } from "rate-limiter-flexible";

import {
  PAIR_SERVE_LIMIT,
  PAIR_SERVE_WINDOW,
  PAIR_SERVE_WINDOW_SECONDS,
  RATE_LIMIT_MAX_TOKENS,
  RATE_LIMIT_PAIR_PREFIX,
  RATE_LIMIT_PREFIX,
  RATE_LIMIT_REFILL_INTERVAL,
  RATE_LIMIT_REFILL_TOKENS,
  RATE_LIMIT_UPLOAD_DAILY_PREFIX,
  RATE_LIMIT_UPLOAD_PREFIX,
  RATE_LIMIT_WINDOW_SECONDS,
  UPLOAD_BURST_LIMIT,
  UPLOAD_BURST_WINDOW,
  UPLOAD_BURST_WINDOW_SECONDS,
  UPLOAD_DAILY_LIMIT,
  UPLOAD_DAILY_WINDOW,
  UPLOAD_DAILY_WINDOW_SECONDS,
} from "@/lib/constants";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis-client";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
};

export { check, checkPairServe, checkUploadBurst, checkUploadDaily };

// ── Driver: Upstash (HTTP, serverless — current Vercel prod) ────────────────
let upstashLimiter: Ratelimit | null = null;

function getUpstashLimiter(): Ratelimit {
  if (!upstashLimiter) {
    upstashLimiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.tokenBucket(
        RATE_LIMIT_REFILL_TOKENS,
        RATE_LIMIT_REFILL_INTERVAL,
        RATE_LIMIT_MAX_TOKENS,
      ),
      analytics: true,
      prefix: RATE_LIMIT_PREFIX,
    });
  }
  return upstashLimiter;
}

async function checkUpstash(key: string): Promise<RateLimitResult> {
  const { success, remaining, pending } = await getUpstashLimiter().limit(key);
  // Node runtime: await pending so analytics are not dropped (no edge waitUntil).
  await pending;
  return { ok: success, remaining };
}

// ── Driver: standard Redis (ioredis/TCP — persistent VPS) ───────────────────
let redisLimiter: RateLimiterRedis | null = null;

function getRedisLimiter(): RateLimiterRedis {
  if (!redisLimiter) {
    redisLimiter = new RateLimiterRedis({
      storeClient: getRedis(),
      keyPrefix: RATE_LIMIT_PREFIX,
      points: RATE_LIMIT_MAX_TOKENS,
      duration: RATE_LIMIT_WINDOW_SECONDS,
    });
  }
  return redisLimiter;
}

async function checkRedis(key: string): Promise<RateLimitResult> {
  try {
    const res = await getRedisLimiter().consume(key, 1);
    return { ok: true, remaining: res.remainingPoints };
  } catch (err) {
    // rate-limiter-flexible rejects with a RateLimiterRes (NOT an Error) when the
    // limit is exceeded; a real Redis failure rejects with an Error — rethrow that.
    if (err instanceof Error) {
      throw err;
    }
    const remaining = (err as { remainingPoints?: number }).remainingPoints ?? 0;
    return { ok: false, remaining };
  }
}

/**
 * Token-bucket rate-limit check for a voter/report key. Dispatches to the active
 * Redis driver (REDIS_DRIVER): Upstash HTTP on serverless, ioredis on a VPS.
 */
async function check(key: string): Promise<RateLimitResult> {
  return env.REDIS_DRIVER === "redis" ? checkRedis(key) : checkUpstash(key);
}

// ── Named fixed-window limiters (upload endpoints, pair serving) ────────────

type WindowConfig = {
  prefix: string;
  points: number;
  /** Upstash Duration literal — same span as windowSeconds. */
  window: Parameters<typeof Ratelimit.fixedWindow>[1];
  windowSeconds: number;
};

const UPLOAD_BURST_CONFIG: WindowConfig = {
  prefix: RATE_LIMIT_UPLOAD_PREFIX,
  points: UPLOAD_BURST_LIMIT,
  window: UPLOAD_BURST_WINDOW,
  windowSeconds: UPLOAD_BURST_WINDOW_SECONDS,
};

const UPLOAD_DAILY_CONFIG: WindowConfig = {
  prefix: RATE_LIMIT_UPLOAD_DAILY_PREFIX,
  points: UPLOAD_DAILY_LIMIT,
  window: UPLOAD_DAILY_WINDOW,
  windowSeconds: UPLOAD_DAILY_WINDOW_SECONDS,
};

const PAIR_SERVE_CONFIG: WindowConfig = {
  prefix: RATE_LIMIT_PAIR_PREFIX,
  points: PAIR_SERVE_LIMIT,
  window: PAIR_SERVE_WINDOW,
  windowSeconds: PAIR_SERVE_WINDOW_SECONDS,
};

// One limiter instance per prefix per driver, created lazily like the vote bucket.
const upstashWindowLimiters = new Map<string, Ratelimit>();
const redisWindowLimiters = new Map<string, RateLimiterRedis>();

function getUpstashWindowLimiter(config: WindowConfig): Ratelimit {
  let limiter = upstashWindowLimiters.get(config.prefix);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(config.points, config.window),
      analytics: true,
      prefix: config.prefix,
    });
    upstashWindowLimiters.set(config.prefix, limiter);
  }
  return limiter;
}

function getRedisWindowLimiter(config: WindowConfig): RateLimiterRedis {
  let limiter = redisWindowLimiters.get(config.prefix);
  if (!limiter) {
    limiter = new RateLimiterRedis({
      storeClient: getRedis(),
      keyPrefix: config.prefix,
      points: config.points,
      duration: config.windowSeconds,
    });
    redisWindowLimiters.set(config.prefix, limiter);
  }
  return limiter;
}

async function checkWindowUpstash(config: WindowConfig, key: string): Promise<RateLimitResult> {
  const { success, remaining, pending } = await getUpstashWindowLimiter(config).limit(key);
  // Node runtime: await pending so analytics are not dropped (no edge waitUntil).
  await pending;
  return { ok: success, remaining };
}

async function checkWindowRedis(config: WindowConfig, key: string): Promise<RateLimitResult> {
  try {
    const res = await getRedisWindowLimiter(config).consume(key, 1);
    return { ok: true, remaining: res.remainingPoints };
  } catch (err) {
    // See checkRedis: an over-limit rejection is a RateLimiterRes, not an Error.
    if (err instanceof Error) {
      throw err;
    }
    const remaining = (err as { remainingPoints?: number }).remainingPoints ?? 0;
    return { ok: false, remaining };
  }
}

async function checkWindow(config: WindowConfig, key: string): Promise<RateLimitResult> {
  return env.REDIS_DRIVER === "redis"
    ? checkWindowRedis(config, key)
    : checkWindowUpstash(config, key);
}

/**
 * Shared per-user minute budget for the upload surface: /api/upload/sign,
 * POST /api/cats and the cabinet add-photo action. Bounds the duplicate-submission
 * loop and turns the sign-time hash-existence check into a throttled oracle.
 */
async function checkUploadBurst(userId: string): Promise<RateLimitResult> {
  return checkWindow(UPLOAD_BURST_CONFIG, userId);
}

/** Per-user daily cap on signed files — the doc's "uploads per day" limit. */
async function checkUploadDaily(userId: string): Promise<RateLimitResult> {
  return checkWindow(UPLOAD_DAILY_CONFIG, userId);
}

/** Per-voter cap on pair batches — bounds pair-token farming via ?count=. */
async function checkPairServe(voterKey: string): Promise<RateLimitResult> {
  return checkWindow(PAIR_SERVE_CONFIG, voterKey);
}
