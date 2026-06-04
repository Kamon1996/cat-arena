import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { CatCell } from "@/components/ui/cat-cell";
import { cn } from "@/lib/utils";

const GOLD_RANK = 1;
const SILVER_RANK = 2;
const BRONZE_RANK = 3;

const RANK_COLUMN = "3.5rem";
const STAT_COLUMN = "minmax(0, 7rem)";

/** Rank medallion colour — top three get a podium tone, the rest stay muted. */
function medalClassName(rank: number): string {
  if (rank === GOLD_RANK) {
    return "bg-delight text-delight-foreground";
  }
  if (rank === SILVER_RANK) {
    // A mid grey, clearly darker than the muted default so #2 still reads as podium.
    return "bg-[color-mix(in_oklab,var(--muted-foreground)_22%,var(--card))] text-foreground";
  }
  if (rank === BRONZE_RANK) {
    return "bg-secondary text-secondary-foreground";
  }
  return "bg-muted text-muted-foreground";
}

export interface LeaderboardEntry {
  id: string;
  /** 1-based rank; drives the medallion + leader tint. */
  rank: number;
  name: string;
  handle?: string;
  /** Makes the whole row a link (e.g. the cat page). */
  href?: string;
  /** Avatar colours (default: deterministic brand colour from the name). */
  color?: string;
  fg?: string;
  /** Right-aligned stat cells, in the same order as `statHeaders`. */
  stats: ReactNode[];
}

export interface LeaderboardProps {
  /** Accessible name for the ranking list. */
  label: string;
  /** Headers for the stat columns (after rank + cat). Must be unique (used as keys). */
  statHeaders: string[];
  entries: LeaderboardEntry[];
  className?: string;
}

/** Shared grid template so the header row and every data row line up perfectly. */
export function leaderboardGridStyle(statCount: number): CSSProperties {
  return {
    gridTemplateColumns: `${RANK_COLUMN} minmax(0, 1fr) repeat(${statCount}, ${STAT_COLUMN})`,
  };
}

/** Column header strip (Rank · Cat · …stat columns). Server-renderable. */
export function LeaderboardHeader({
  statHeaders,
  gridStyle,
  className,
}: {
  statHeaders: string[];
  gridStyle: CSSProperties;
  className?: string;
}) {
  return (
    <div
      style={gridStyle}
      className={cn(
        "grid items-center gap-4 px-5 font-semibold text-muted-foreground text-xs uppercase tracking-wider",
        className,
      )}
    >
      <span>Rank</span>
      <span>Cat</span>
      {statHeaders.map((header) => (
        <span key={header} className="text-right">
          {header}
        </span>
      ))}
    </div>
  );
}

/**
 * A single "sticker row" ranking card — the inner content of an `<li>`. Shared by
 * the static {@link Leaderboard} and the window-virtualized list so both lists
 * render identical rows. Wrap it in your own `<li>` (positioned or in flow).
 */
export function LeaderboardRowCard({
  entry,
  statHeaders,
  gridStyle,
}: {
  entry: LeaderboardEntry;
  statHeaders: string[];
  gridStyle: CSSProperties;
}) {
  const lead = entry.rank === GOLD_RANK;
  const rowClassName = cn(
    "grid items-center gap-4 rounded-lg border-2 border-ink px-5 py-3 shadow-sticker transition-[transform,box-shadow] duration-150 ease-spring hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lg",
    lead ? "bg-[color-mix(in_oklab,var(--delight)_16%,var(--card))]" : "bg-card",
  );
  const cells = (
    <>
      <span
        className={cn(
          "grid size-9.5 place-items-center rounded-full border-2 border-ink font-display font-bold text-base",
          medalClassName(entry.rank),
        )}
      >
        {entry.rank}
      </span>
      <CatCell name={entry.name} handle={entry.handle} color={entry.color} fg={entry.fg} />
      {statHeaders.map((header, i) => (
        <span key={header} className="text-right">
          <span className="sr-only">{header}: </span>
          {entry.stats[i]}
        </span>
      ))}
    </>
  );

  if (entry.href) {
    return (
      <Link
        href={entry.href}
        style={gridStyle}
        className={cn(
          rowClassName,
          "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
        )}
      >
        {cells}
      </Link>
    );
  }
  return (
    <div style={gridStyle} className={rowClassName}>
      {cells}
    </div>
  );
}

/**
 * Colourful "sticker row" ranking — each row is its own bordered card with a
 * rank medallion that lifts on hover. Reusable for any cat ranking; the trailing
 * stat columns are configurable via `statHeaders` + each entry's `stats`. Renders
 * every entry in document flow (use it for short lists; the /top page uses the
 * window-virtualized variant for the full 100-cat board).
 */
export function Leaderboard({ label, statHeaders, entries, className }: LeaderboardProps) {
  const gridStyle = leaderboardGridStyle(statHeaders.length);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <LeaderboardHeader statHeaders={statHeaders} gridStyle={gridStyle} />
      <ol aria-label={label} className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={entry.id}>
            <LeaderboardRowCard entry={entry} statHeaders={statHeaders} gridStyle={gridStyle} />
          </li>
        ))}
      </ol>
    </div>
  );
}
