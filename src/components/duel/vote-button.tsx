"use client";

import { Button } from "@/components/ui/button";

type VoteButtonProps = {
  label: string;
  onVote: () => void;
  disabled: boolean;
};

export function VoteButton({ label, onVote, disabled }: VoteButtonProps) {
  return (
    <Button
      type="button"
      aria-label={label}
      onClick={onVote}
      disabled={disabled}
      className="w-full"
    >
      {label}
    </Button>
  );
}
