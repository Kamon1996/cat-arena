import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import {
  RATE_LIMIT_MAX_TOKENS,
  RATE_LIMIT_PREFIX,
  RATE_LIMIT_REFILL_INTERVAL,
  RATE_LIMIT_REFILL_TOKENS,
} from "@/lib/constants";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
};

export { check };

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.tokenBucket(
    RATE_LIMIT_REFILL_TOKENS,
    RATE_LIMIT_REFILL_INTERVAL,
    RATE_LIMIT_MAX_TOKENS,
  ),
  analytics: true,
  prefix: RATE_LIMIT_PREFIX,
});

async function check(key: string): Promise<RateLimitResult> {
  const { success, remaining, pending } = await ratelimit.limit(key);
  // Node runtime: await pending so analytics are not dropped (no edge waitUntil).
  await pending;
  return { ok: success, remaining };
}
