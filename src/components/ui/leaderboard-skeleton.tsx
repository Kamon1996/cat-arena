import { leaderboardGridStyle } from "@/components/ui/leaderboard";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_ROWS = 8;
const STAT_COLUMNS = 2; // Score · W/L — matches the /top + org boards.

/**
 * Placeholder for {@link Leaderboard} / {@link VirtualLeaderboard} while the rows
 * stream in. Reuses the real grid template so the skeleton lines up with the
 * loaded board (no layout shift). Decorative — wrap it in a labelled
 * `role="status"` container in the loading.tsx that uses it.
 */
export function LeaderboardSkeleton({ rows = DEFAULT_ROWS }: { rows?: number }) {
  const gridStyle = leaderboardGridStyle(STAT_COLUMNS);
  const rowKeys = Array.from({ length: rows }, (_, i) => `leaderboard-skeleton-row-${i}`);

  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div style={gridStyle} className="grid items-center gap-4 px-5">
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12 justify-self-end" />
        <Skeleton className="h-3 w-10 justify-self-end" />
      </div>
      {rowKeys.map((rowKey) => (
        <div
          key={rowKey}
          style={gridStyle}
          className="grid items-center gap-4 rounded-lg border-2 border-border bg-card px-5 py-3"
        >
          <Skeleton className="size-9.5 rounded-full" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
          <Skeleton className="h-5 w-12 justify-self-end" />
          <Skeleton className="h-5 w-10 justify-self-end" />
        </div>
      ))}
    </div>
  );
}
