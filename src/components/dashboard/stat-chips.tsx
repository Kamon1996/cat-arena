import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Above this rating-deviation the Glicko rating is still "settling". */
const UNCERTAIN_RD = 90;

export type CatStats = {
  rank: number | null;
  score: number;
  rating: number;
  rd: number;
  wins: number;
  losses: number;
  timesShown: number;
};

function Chip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-border bg-muted px-2.5 py-1.5 text-[13px] font-semibold">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

export function CatStatChips({ stats, className }: { stats: CatStats; className?: string }) {
  const votes = stats.wins + stats.losses;
  const settling = stats.rd > UNCERTAIN_RD;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {/* A ranked cat wears the medallion in the card header instead. */}
      {stats.rank === null ? <Chip label="Rank">unranked</Chip> : null}
      <Chip label="Score">{Math.round(stats.score)}</Chip>
      <Chip label="Rating μ">
        {Math.round(stats.rating)}
        {settling ? (
          <span
            className="text-muted-foreground"
            title={`Few votes so far — rating is still settling (±${Math.round(stats.rd)})`}
          >
            · settling
          </span>
        ) : null}
      </Chip>
      <Chip label="W–L">
        {stats.wins}–{stats.losses}
      </Chip>
      <Chip label="Shown">{stats.timesShown}</Chip>
      <Chip label="Votes">{votes}</Chip>
    </div>
  );
}
