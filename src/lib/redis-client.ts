import "server-only";

import Redis from "ioredis";

import { env } from "@/lib/env";

// Standard TCP Redis client (ioredis) for the persistent-server / VPS deployment
// (REDIS_DRIVER=redis). This is the canonical client for a long-running Node
// process — sub-ms per command over a kept-alive socket — versus the Upstash
// HTTP client used on serverless (Vercel). Created lazily so importing this
// module is side-effect free and no connection is opened under driver=upstash.

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

// Module-level singleton: created once per process, reused across calls. The
// global ref only survives dev hot-reload (avoids leaking a socket per reload).
let client: Redis | undefined = globalForRedis.redis;

function createRedis(): Redis {
  if (!env.REDIS_URL) {
    throw new Error("getRedis() called without REDIS_URL (REDIS_DRIVER must be 'redis')");
  }
  return new Redis(env.REDIS_URL, {
    // Fail fast instead of buffering commands forever if Redis is unreachable —
    // the rate-limit/nonce call sites must surface the error, not hang.
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });
}

/** Lazily-created, process-wide ioredis singleton. Only valid when REDIS_DRIVER=redis. */
export function getRedis(): Redis {
  if (!client) {
    client = createRedis();
    if (process.env.NODE_ENV !== "production") {
      globalForRedis.redis = client;
    }
  }
  return client;
}

/** Quit the connection if one was opened (used on graceful shutdown). No-op otherwise. */
export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = undefined;
    globalForRedis.redis = undefined;
  }
}
