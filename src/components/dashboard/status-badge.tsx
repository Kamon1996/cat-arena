import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

// Maps a Cat/Image status to a Badge variant. Falls back to a neutral outline.
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  APPROVED: "success",
  PENDING: "warning",
  HIDDEN: "outline",
  REJECTED: "destructive",
  BANNED: "destructive",
};

type StatusBadgeProps = {
  status: string;
  mini?: boolean;
  className?: string;
};

export function StatusBadge({ status, mini, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? "outline";
  return (
    <Badge variant={variant} className={cn(mini && "gap-1 px-2 py-0.5 text-[10px]", className)}>
      {variant === "outline" ? null : (
        <span className={cn("rounded-full bg-current", mini ? "size-1" : "size-1.5")} />
      )}
      {status}
    </Badge>
  );
}
