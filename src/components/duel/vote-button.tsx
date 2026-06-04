"use client";

import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";

type VoteButtonProps = {
  label: string;
  onVote: () => void;
  disabled: boolean;
  /** "a" → primary (teal), "b" → secondary (tangerine). */
  tone?: "a" | "b";
};

export function VoteButton({ label, onVote, disabled, tone = "a" }: VoteButtonProps) {
  return (
    <Button
      type="button"
      variant={tone === "a" ? "default" : "secondary"}
      size="lg"
      aria-label={label}
      onClick={onVote}
      disabled={disabled}
      className="w-full gap-2.5"
    >
      {label}
      <Heart aria-hidden />
    </Button>
  );
}
