import { LeaderboardSkeleton } from "@/components/ui/leaderboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

const ORG_BOARD_ROWS = 6;

export default function OrgLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-3xl px-4 py-8">
      <span className="sr-only">Loading organization…</span>
      <Skeleton className="h-9 w-1/2" />
      <Skeleton className="mt-3 mb-8 h-4 w-2/3" />
      <LeaderboardSkeleton rows={ORG_BOARD_ROWS} />
    </div>
  );
}
