"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { captureEvent } from "@/lib/analytics";
import type { PairResponse } from "@/lib/api-types";
import { ANALYTICS_EVENT } from "@/lib/constants";

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

  // Fire once per served pair (query.data is a fresh object on each fetch).
  useEffect(() => {
    if (query.data) {
      captureEvent(ANALYTICS_EVENT.PAIR_SERVED, {
        a_cat_id: query.data.a.id,
        b_cat_id: query.data.b.id,
        scope,
      });
    }
  }, [query.data, scope]);

  return query;
}
