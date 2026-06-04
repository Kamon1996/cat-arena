import type * as React from "react";

import { cn } from "@/lib/utils";

export type ToggleChipProps = React.ComponentProps<"button"> & {
  /** Selected state — drives the destructive tint and `aria-pressed`. */
  pressed: boolean;
};

/** A rounded multi-select chip (a toggle button). Used for moderation flags /
 *  rejection reasons. Selected chips take a destructive tint. */
export function ToggleChip({ pressed, className, ...props }: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center rounded-full border-2 px-3.5 py-2 font-semibold text-sm transition-[transform,background-color,border-color,color] duration-100 ease-spring active:scale-95 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
        pressed
          ? "border-destructive bg-[color-mix(in_oklab,var(--destructive)_14%,var(--card))] text-[color-mix(in_oklab,var(--destructive)_72%,var(--foreground))]"
          : "border-border bg-card text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
