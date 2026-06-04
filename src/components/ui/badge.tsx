import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:ring-ring/40 [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "border-ink bg-primary text-primary-foreground",
        secondary: "border-ink bg-secondary text-secondary-foreground",
        solid: "border-ink bg-accent text-accent-foreground",
        success:
          "border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-[color-mix(in_oklab,var(--success)_16%,var(--card))] text-[color-mix(in_oklab,var(--success)_60%,var(--foreground))]",
        warning:
          "border-[color-mix(in_oklab,var(--warning)_45%,transparent)] bg-[color-mix(in_oklab,var(--warning)_18%,var(--card))] text-[color-mix(in_oklab,var(--warning)_55%,var(--foreground))]",
        destructive:
          "border-[color-mix(in_oklab,var(--destructive)_42%,transparent)] bg-[color-mix(in_oklab,var(--destructive)_14%,var(--card))] text-[color-mix(in_oklab,var(--destructive)_62%,var(--foreground))]",
        outline: "border-ink bg-transparent text-muted-foreground",
        ghost: "border-transparent text-foreground",
        link: "border-transparent text-primary underline underline-offset-4",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  dot = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** Leading status dot in the current text color (status-style badges). Not for `asChild`. */
    dot?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {dot ? <span className="size-1.5 shrink-0 rounded-full bg-current" /> : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants };
