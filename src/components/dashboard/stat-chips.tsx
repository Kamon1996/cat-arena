import { Trophy } from "lucide-react";
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

function Chip({
  label,
  highlight,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold",
        highlight
          ? "border-[color-mix(in_oklab,var(--delight)_55%,transparent)] bg-[color-mix(in_oklab,var(--delight)_24%,var(--card))]"
          : "border-border bg-muted",
      )}
    >
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </span>
  );
}

export function CatStatChips({ stats }: { stats: CatStats }) {
  const votes = stats.wins + stats.losses;
  const settling = stats.rd > UNCERTAIN_RD;

  return (
    <div className="flex flex-wrap gap-2">
      <Chip label="Rank" highlight={stats.rank !== null}>
        {stats.rank !== null ? (
          <span className="inline-flex items-center gap-1">
            <Trophy className="size-3.5" aria-hidden />#{stats.rank}
          </span>
        ) : (
          "unranked"
        )}
      </Chip>
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
