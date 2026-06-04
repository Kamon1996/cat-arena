import { Skeleton } from "@/components/ui/skeleton";

// Root fallback loading UI: gives every navigation an instant skeleton (then the
// page streams in) for any route segment without its own loading.tsx.
export default function Loading() {
  return (
    <div role="status" className="mx-auto w-full max-w-3xl px-4 py-10">
      <span className="sr-only">Loading…</span>
      <Skeleton className="mb-6 h-9 w-56" />
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    </div>
  );
}
