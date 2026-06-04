import type * as React from "react";

import { STICKER_FIELD } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        STICKER_FIELD,
        "min-h-24 w-full resize-y rounded-md px-4 py-3 text-base leading-normal placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
