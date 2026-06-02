"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { VoteRequest, VoteResponse } from "@/lib/api-types";
import { PAIR_QUERY_KEY } from "./use-next-pair";

async function submitVote(body: VoteRequest): Promise<VoteResponse> {
  const res = await fetch("/api/vote", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Vote failed: ${res.status}`);
  }
  return (await res.json()) as VoteResponse;
}

export function useSubmitVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitVote,
    onSettled: () => queryClient.invalidateQueries({ queryKey: PAIR_QUERY_KEY }),
  });
}
