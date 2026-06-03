"use client";

import { DuelArena } from "@/components/duel/duel-arena";

type OrgFeedProps = {
  orgId: string;
  canVote: boolean;
};

export function OrgFeed({ orgId, canVote }: OrgFeedProps) {
  if (!canVote) {
    return (
      <div
        role="status"
        className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm"
      >
        Voting in this feed is members only. Join one of your cats to this organization to vote.
      </div>
    );
  }
  return <DuelArena scope={orgId} />;
}
