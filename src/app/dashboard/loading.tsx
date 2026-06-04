import { Skeleton } from "@/components/ui/skeleton";

const CARD_KEYS = ["cat-card-skeleton-a", "cat-card-skeleton-b"];

export default function DashboardLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-5xl px-4 py-8">
      <span className="sr-only">Loading your cats…</span>
      <div className="mb-6 flex items-end justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {CARD_KEYS.map((cardKey) => (
          <div key={cardKey} className="rounded-xl border-2 border-border bg-card p-4">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton className="mt-4 h-6 w-32" />
            <div className="mt-3 flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
