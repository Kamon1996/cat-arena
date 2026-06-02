"use client";

import { SkipForward } from "lucide-react";

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
      aria-label="Skip this pair"
      onClick={onSkip}
      disabled={disabled}
    >
      <SkipForward aria-hidden />
      Skip
    </Button>
  );
}
