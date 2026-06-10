import "server-only";

import { Redis } from "@upstash/redis";

import { PAIR_TOKEN_TTL_SECONDS } from "@/lib/constants";
import { env } from "@/lib/env";
import { getRedis } from "@/lib/redis-client";

const NONCE_PREFIX = "nonce:";

// ── Driver: Upstash (HTTP, serverless — current Vercel prod) ────────────────
let upstash: Redis | null = null;

function getUpstash(): Redis {
  if (!upstash) {
    upstash = new Redis({
      url: env.UPSTASH_REDIS_REST_URL ?? "",
      token: env.UPSTASH_REDIS_REST_TOKEN ?? "",
    });
  }
  return upstash;
}

async function consumeNonceUpstash(key: string): Promise<boolean> {
  const result = await getUpstash().set(key, "1", { nx: true, ex: PAIR_TOKEN_TTL_SECONDS });
  return result === "OK";
}

// ── Driver: standard Redis (ioredis/TCP — persistent VPS) ───────────────────
async function consumeNonceRedis(key: string): Promise<boolean> {
  // ioredis SET key 1 EX <ttl> NX → "OK" on first write, null on replay.
  const result = await getRedis().set(key, "1", "EX", PAIR_TOKEN_TTL_SECONDS, "NX");
  return result === "OK";
}

/**
 * Atomically claim a nonce. Returns true the first time, false on replay.
 * SET NX with the token TTL guarantees single use within the token window.
 * Dispatches to the active Redis driver (REDIS_DRIVER).
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const key = `${NONCE_PREFIX}${nonce}`;
  return env.REDIS_DRIVER === "redis" ? consumeNonceRedis(key) : consumeNonceUpstash(key);
}
