import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Brand avatar palette — a cat always gets the same color (hashed from its name). */
const AVATAR_PALETTE = [
  { bg: "var(--primary)", fg: "var(--primary-foreground)" },
  { bg: "var(--secondary)", fg: "var(--secondary-foreground)" },
  { bg: "var(--accent)", fg: "var(--accent-foreground)" },
  { bg: "var(--delight)", fg: "var(--delight-foreground)" },
] as const;

/** Multiplier for the simple deterministic string hash. */
const HASH_PRIME = 31;

function avatarColor(seed: string): (typeof AVATAR_PALETTE)[number] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * HASH_PRIME + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length] ?? AVATAR_PALETTE[0];
}

export interface CatCellProps {
  name: string;
  // handle/color/fg accept `undefined` so callers can forward optional row data directly.
  handle?: string | undefined;
  /** Avatar background (CSS color); defaults to a deterministic brand color from `name`. */
  color?: string | undefined;
  /** Avatar text color; pair with `color`. */
  fg?: string | undefined;
  /** Smaller avatar + name for dense tables. */
  compact?: boolean;
  className?: string;
}

/**
 * Avatar (the cat's initial in a sticker square) + name, with an optional handle
 * line. The avatar is decorative (`aria-hidden`) — the name carries the label.
 * Used in leaderboards and other cat lists.
 */
export function CatCell({ name, handle, color, fg, compact = false, className }: CatCellProps) {
  const picked = avatarColor(name);
  const style: CSSProperties = { background: color ?? picked.bg, color: fg ?? picked.fg };

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        aria-hidden
        style={style}
        className={cn(
          "grid shrink-0 place-items-center border-2 border-ink font-display font-bold",
          compact ? "size-8 rounded-[0.5rem] text-sm" : "size-10 rounded-sm text-lg",
        )}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0">
        <div className={cn("truncate font-semibold", compact ? "text-sm" : "text-[0.9375rem]")}>
          {name}
        </div>
        {handle ? <div className="truncate text-muted-foreground text-xs">{handle}</div> : null}
      </div>
    </div>
  );
}
