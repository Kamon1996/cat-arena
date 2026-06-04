"use client";

import { Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";

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
      onClick={onSkip}
      disabled={disabled}
      className="text-muted-foreground"
    >
      <Shuffle aria-hidden />
      Skip — show me a new pair
    </Button>
  );
}
