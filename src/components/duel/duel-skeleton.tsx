import { VsBadge } from "@/components/duel/vs-badge";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonCard() {
  return (
    <div className="w-full max-w-110 overflow-hidden rounded-xl border-2 border-border bg-card shadow-soft sm:max-w-none sm:flex-1">
      <Skeleton className="aspect-square rounded-none" />
      <div className="p-4">
        <Skeleton className="mx-auto h-6 w-3/5" />
        <Skeleton className="mt-3 h-12 rounded-full" />
      </div>
    </div>
  );
}

export function DuelSkeleton() {
  return (
    <div className="flex w-full max-w-220 items-stretch justify-center gap-3 max-sm:flex-col max-sm:items-center sm:gap-6">
      <SkeletonCard />
      <VsBadge className="opacity-40" />
      <SkeletonCard />
    </div>
  );
}
