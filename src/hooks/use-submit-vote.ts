"use client";

import { useMutation } from "@tanstack/react-query";

import { captureEvent } from "@/lib/analytics";
import type { VoteRequest, VoteResponse } from "@/lib/api-types";
import { ANALYTICS_EVENT } from "@/lib/constants";

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

/**
 * Records a vote. The pair query is intentionally NOT invalidated here — the
 * duel UI drives the transition to the next pair after its win/lose
 * celebration finishes (see DuelArena), so timing stays under its control.
 */
export function useSubmitVote() {
  return useMutation({
    mutationFn: submitVote,
    onSuccess: (data) =>
      captureEvent(ANALYTICS_EVENT.VOTE_CAST, {
        winner_cat_id: data.winner.id,
        loser_cat_id: data.loser.id,
      }),
  });
}
