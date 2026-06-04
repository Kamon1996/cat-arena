"use client";

import { Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { captureEvent } from "@/lib/analytics";
import { ANALYTICS_EVENT } from "@/lib/constants";

type SkipButtonProps = {
  onSkip: () => void;
  disabled: boolean;
};

export function SkipButton({ onSkip, disabled }: SkipButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label="Skip and show a new pair"
      onClick={() => {
        captureEvent(ANALYTICS_EVENT.SKIP);
        onSkip();
      }}
      disabled={disabled}
      className="text-muted-foreground"
    >
      <Shuffle aria-hidden />
      Skip — show me a new pair
    </Button>
  );
}
