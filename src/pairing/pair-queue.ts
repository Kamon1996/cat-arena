import type { PairResponse } from "@/lib/api-types";

export type RefillBounds = {
  min: number; // watermark: queue at/below this triggers a top-up
  target: number; // size the queue is topped back up to
};

export { appendPairs, pruneExpired, refillCount };

/** Drop pairs whose vote window has closed (expiresAt is epoch ms). */
function pruneExpired(queue: PairResponse[], nowMs: number): PairResponse[] {
  return queue.filter((pair) => pair.expiresAt > nowMs);
}

/**
 * Watermark refill: how many pairs to request. Zero while the queue is above
 * the watermark — one batched top-up per drain instead of a request per vote.
 */
function refillCount(queueLength: number, bounds: RefillBounds): number {
  if (queueLength > bounds.min) {
    return 0;
  }
  return Math.max(0, bounds.target - queueLength);
}

/** Append incoming pairs, dropping tokens already queued (overlapping refills). */
function appendPairs(queue: PairResponse[], incoming: PairResponse[]): PairResponse[] {
  const queued = new Set(queue.map((pair) => pair.token));
  return [...queue, ...incoming.filter((pair) => !queued.has(pair.token))];
}
