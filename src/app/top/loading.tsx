import { LeaderboardSkeleton } from "@/components/ui/leaderboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function TopLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <span className="sr-only">Loading the leaderboard…</span>
      <Skeleton className="mb-6 h-9 w-44" />
      <LeaderboardSkeleton />
    </div>
  );
}
