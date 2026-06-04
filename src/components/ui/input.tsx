import type * as React from "react";

import { STICKER_FIELD } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        STICKER_FIELD,
        "h-12 w-full min-w-0 rounded-md px-4 text-base selection:bg-primary selection:text-primary-foreground file:mr-3 file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
