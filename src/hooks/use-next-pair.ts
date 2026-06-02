"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const query = useQuery({
    queryKey: [...PAIR_QUERY_KEY, scope],
    queryFn: () => fetchPair(scope),
  });

  const queryClient = useQueryClient();
  const prefetchNext = () =>
    queryClient.prefetchQuery({
      queryKey: [...PAIR_QUERY_KEY, scope],
      queryFn: () => fetchPair(scope),
    });

  return { ...query, prefetchNext };
}
