import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 font-display font-semibold outline-none transition-[transform,box-shadow,background-color,color] duration-150 ease-spring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0 disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          "border-ink bg-primary text-primary-foreground shadow-sticker hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-press",
        secondary:
          "border-ink bg-secondary text-secondary-foreground shadow-sticker hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-press",
        destructive:
          "border-ink bg-destructive text-destructive-foreground shadow-sticker hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sticker-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-press",
        outline:
          "border-ink bg-card text-foreground shadow-sticker hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-muted hover:shadow-sticker-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-sticker-press",
        ghost: "border-transparent text-foreground hover:bg-muted",
        link: "rounded-sm border-transparent text-primary underline decoration-2 underline-offset-4 hover:text-primary/80",
      },
      size: {
        default: "h-[46px] px-[22px] text-base",
        xs: "h-[30px] gap-1.5 px-3 text-[13px] [&_svg:not([class*='size-'])]:size-4",
        sm: "h-[38px] px-4 text-[15px]",
        lg: "h-14 px-[30px] text-lg",
        icon: "size-[46px] p-0",
        "icon-xs": "size-[30px] p-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-[38px] p-0",
        "icon-lg": "size-14 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
