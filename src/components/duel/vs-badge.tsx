import { cn } from "@/lib/utils";

export function VsBadge({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid size-14 shrink-0 place-items-center self-center rounded-full border-2 border-ink bg-delight font-display text-xl font-bold text-delight-foreground shadow-sticker",
        className,
      )}
    >
      VS
    </div>
  );
}
