import "server-only";

import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

const UNAUTHORIZED = 401;
const CRON_DISABLED = 503;

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: typeof UNAUTHORIZED | typeof CRON_DISABLED };

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Authorize a /api/cron/* request via `Authorization: Bearer <CRON_SECRET>`.
 * If CRON_SECRET is unset the endpoint is disabled (503) rather than open — cron
 * must never run unauthenticated. Comparison is timing-safe.
 */
export function authorizeCron(request: Request): CronAuthResult {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return { ok: false, status: CRON_DISABLED };
  }
  const header = request.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return { ok: false, status: UNAUTHORIZED };
  }
  return { ok: true };
}
