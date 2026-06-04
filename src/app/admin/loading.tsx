import { Skeleton } from "@/components/ui/skeleton";

const ROW_KEYS = ["moderation-skeleton-a", "moderation-skeleton-b", "moderation-skeleton-c"];

export default function AdminLoading() {
  return (
    <div role="status" className="mx-auto w-full max-w-5xl px-4 py-8">
      <span className="sr-only">Loading the moderation queue…</span>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 mb-6 h-4 w-56" />
      <div className="space-y-4">
        {ROW_KEYS.map((rowKey) => (
          <div
            key={rowKey}
            className="flex items-center gap-4 rounded-lg border-2 border-border p-4"
          >
            <Skeleton className="size-20 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
