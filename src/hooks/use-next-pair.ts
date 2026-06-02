"use client";

import { useQuery } from "@tanstack/react-query";

import type { PairResponse } from "@/lib/api-types";

export const PAIR_QUERY_KEY = ["pair"] as const;

async function fetchPair(scope: string): Promise<PairResponse> {
  const params = scope === "global" ? "" : `?scope=${encodeURIComponent(scope)}`;
  const res = await fetch(`/api/pair${params}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Pair fetch failed: ${res.status}`);
  }
  return (await res.json()) as PairResponse;
}

export function useNextPair(scope = "global") {
  return useQuery({
    queryKey: [...PAIR_QUERY_KEY, scope],
    queryFn: () => fetchPair(scope),
  });
}
