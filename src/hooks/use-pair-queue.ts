"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { captureEvent } from "@/lib/analytics";
import type { PairBatchResponse, PairResponse } from "@/lib/api-types";
import {
  ANALYTICS_EVENT,
  PAIR_FETCH_TIMEOUT_MS,
  PAIR_QUEUE_MIN_SIZE,
  PAIR_QUEUE_TARGET_SIZE,
} from "@/lib/constants";
import { appendPairs, pruneExpired, refillCount } from "@/pairing/pair-queue";

const QUEUE_BOUNDS = { min: PAIR_QUEUE_MIN_SIZE, target: PAIR_QUEUE_TARGET_SIZE } as const;

async function fetchPairBatch(
  scope: string,
  count: number,
  signal: AbortSignal,
): Promise<PairResponse[]> {
  const params = new URLSearchParams({ count: String(count) });
  if (scope !== "global") {
    params.set("scope", scope);
  }
  const res = await fetch(`/api/pair?${params.toString()}`, { cache: "no-store", signal });
  if (!res.ok) {
    throw new Error(`Pair fetch failed: ${res.status}`);
  }
  const body = (await res.json()) as PairBatchResponse;
  return body.pairs;
}

/** Warm the browser image cache so the carousel <img> paints from memory on advance. */
function preloadPairImages(pair: PairResponse, preloaded: Set<string>): void {
  for (const cat of [pair.a, pair.b]) {
    for (const image of cat.images) {
      if (preloaded.has(image.url)) {
        continue;
      }
      preloaded.add(image.url);
      new Image().src = image.url;
    }
  }
}

/**
 * Client-side queue of prefetched duel pairs. Keeps PAIR_QUEUE_TARGET_SIZE pairs
 * (with their images preloaded) ready in memory and tops up in the background
 * once the queue drains to PAIR_QUEUE_MIN_SIZE, so advancing after a vote or
 * skip never waits on the network.
 *
 * Deliberately not a React Query cache: pair tokens are single-use, so a
 * consumed pair must never be replayed — the queue is consumable client state.
 */
export function usePairQueue(scope = "global") {
  const [queue, setQueue] = useState<PairResponse[]>([]);
  const [isPending, setIsPending] = useState(true);
  const [isError, setIsError] = useState(false);
  const queueRef = useRef<PairResponse[]>([]);
  // Generation counter: a forced refill (retry / scope reset) supersedes the
  // in-flight request — its late response must neither land in the queue nor
  // flip the in-flight flag back.
  const requestIdRef = useRef(0);
  const activeRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const preloadedRef = useRef(new Set<string>());
  const servedTokenRef = useRef<string | null>(null);

  const applyQueue = useCallback((next: PairResponse[]) => {
    queueRef.current = next;
    setQueue(next);
  }, []);

  const refill = useCallback(
    async (opts?: { force?: boolean }) => {
      if (activeRef.current && !opts?.force) {
        return;
      }
      const need = refillCount(queueRef.current.length, QUEUE_BOUNDS);
      if (need === 0) {
        return;
      }
      // A forced refill aborts the hung/stale request instead of waiting it out.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      activeRef.current = true;
      const timer = window.setTimeout(() => controller.abort(), PAIR_FETCH_TIMEOUT_MS);
      try {
        const incoming = await fetchPairBatch(scope, need, controller.signal);
        if (requestId !== requestIdRef.current) {
          return; // superseded by a newer refill
        }
        for (const pair of incoming) {
          preloadPairImages(pair, preloadedRef.current);
        }
        applyQueue(appendPairs(queueRef.current, incoming));
        setIsError(false);
      } catch {
        // A failed background top-up stays silent (the next advance retries);
        // only an empty queue has nothing to show and must surface the error.
        if (requestId === requestIdRef.current && queueRef.current.length === 0) {
          setIsError(true);
        }
      } finally {
        window.clearTimeout(timer);
        if (requestId === requestIdRef.current) {
          activeRef.current = false;
          setIsPending(false);
        }
      }
    },
    [scope, applyQueue],
  );

  /** Show the next queued pair instantly, then top the queue up in the background. */
  const advance = useCallback(() => {
    const rest = pruneExpired(queueRef.current.slice(1), Date.now());
    applyQueue(rest);
    if (rest.length === 0) {
      setIsPending(true);
    }
    void refill();
  }, [applyQueue, refill]);

  const retry = useCallback(() => {
    setIsError(false);
    setIsPending(queueRef.current.length === 0);
    void refill({ force: true });
  }, [refill]);

  // Reset and load a fresh queue on mount / scope change (refill is keyed by
  // scope); force supersedes any request still in flight for the old scope.
  useEffect(() => {
    queueRef.current = [];
    setQueue([]);
    preloadedRef.current = new Set();
    servedTokenRef.current = null;
    setIsPending(true);
    setIsError(false);
    void refill({ force: true });
    return () => {
      abortRef.current?.abort();
    };
  }, [refill]);

  // Returning to a long-idle tab: drop expired pairs before the user can vote
  // a dead token, then top back up.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      const fresh = pruneExpired(queueRef.current, Date.now());
      if (fresh.length !== queueRef.current.length) {
        applyQueue(fresh);
        if (fresh.length === 0) {
          setIsPending(true);
        }
      }
      void refill();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [applyQueue, refill]);

  const current = queue[0] ?? null;

  // Fire once per pair, the moment it becomes the visible duel (not on prefetch).
  useEffect(() => {
    if (current && servedTokenRef.current !== current.token) {
      servedTokenRef.current = current.token;
      captureEvent(ANALYTICS_EVENT.PAIR_SERVED, {
        a_cat_id: current.a.id,
        b_cat_id: current.b.id,
        scope,
      });
    }
  }, [current, scope]);

  return { current, isPending, isError, advance, retry };
}
