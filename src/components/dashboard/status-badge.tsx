import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

// Maps a Cat/Image status to a Badge variant. Falls back to a neutral outline.
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE: "default",
  APPROVED: "default",
  PENDING: "secondary",
  HIDDEN: "outline",
  REJECTED: "destructive",
  BANNED: "destructive",
};

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"} className={className}>
      {status.toLowerCase()}
    </Badge>
  );
}
