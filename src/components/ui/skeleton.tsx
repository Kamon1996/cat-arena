import type * as React from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-shimmer rounded-md bg-size-[200%_100%] bg-[linear-gradient(100deg,var(--muted)_30%,color-mix(in_oklab,var(--muted)_60%,var(--card))_50%,var(--muted)_70%)] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
