import { Skeleton } from "@/components/ui/skeleton";

const STAT_KEYS = ["cat-stat-rating", "cat-stat-record", "cat-stat-shown"];

export default function CatLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-4xl px-4 py-8">
      <span className="sr-only">Loading cat…</span>
      <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_18rem]">
        <Skeleton className="aspect-square w-full rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-5 w-24" />
          <div className="space-y-3 pt-4">
            {STAT_KEYS.map((statKey) => (
              <Skeleton key={statKey} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
