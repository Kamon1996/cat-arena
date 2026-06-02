import "server-only";

import { Redis } from "@upstash/redis";

import { PAIR_TOKEN_TTL_SECONDS } from "@/lib/constants";
import { env } from "@/lib/env";

const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

const NONCE_PREFIX = "nonce:";

/**
 * Atomically claim a nonce. Returns true the first time, false on replay.
 * SET NX with the token TTL guarantees single use within the token window.
 */
export async function consumeNonce(nonce: string): Promise<boolean> {
  const result = await redis.set(`${NONCE_PREFIX}${nonce}`, "1", {
    nx: true,
    ex: PAIR_TOKEN_TTL_SECONDS,
  });
  return result === "OK";
}
