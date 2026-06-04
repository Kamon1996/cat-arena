"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";

import {
  type LeaderboardEntry,
  LeaderboardHeader,
  LeaderboardRowCard,
  leaderboardGridStyle,
} from "@/components/ui/leaderboard";
import { cn } from "@/lib/utils";

// Card (~66px: avatar + py-3 + border) plus the 12px inter-row gap, folded into each
// measured item. Only a first estimate — measureElement corrects it per row.
const ESTIMATED_ROW_HEIGHT = 78;
const OVERSCAN_ROWS = 8;

interface VirtualLeaderboardProps {
  label: string;
  statHeaders: string[];
  entries: LeaderboardEntry[];
  className?: string;
}

/**
 * Window-virtualized leaderboard: renders only the rows near the viewport so a
 * full 100-cat board stays cheap to scroll. Progressive enhancement keeps SEO
 * intact — the server and the first client render emit the complete list (so
 * crawlers, no-JS visitors, find-in-page, and hydration all see every row), then
 * we upgrade to windowing after mount. Rows are identical to {@link Leaderboard}.
 */
export function VirtualLeaderboard({
  label,
  statHeaders,
  entries,
  className,
}: VirtualLeaderboardProps) {
  const gridStyle = leaderboardGridStyle(statHeaders.length);
  const listRef = useRef<HTMLOListElement>(null);
  const [virtualized, setVirtualized] = useState(false);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }
    // Distance from the top of the document to the list — the window virtualizer
    // measures scroll offset against the window, so absolute item positions are
    // offset by this margin.
    setScrollMargin(list.getBoundingClientRect().top + window.scrollY);
    setVirtualized(true);
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: entries.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    getItemKey: (index) => entries[index]?.id ?? index,
  });

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <LeaderboardHeader statHeaders={statHeaders} gridStyle={gridStyle} />
      {virtualized ? (
        <ol
          ref={listRef}
          aria-label={label}
          className="relative w-full"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const entry = entries[item.index];
            if (!entry) {
              return null;
            }
            return (
              <li
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute top-0 left-0 w-full pb-3"
                style={{
                  transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <LeaderboardRowCard entry={entry} statHeaders={statHeaders} gridStyle={gridStyle} />
              </li>
            );
          })}
        </ol>
      ) : (
        <ol ref={listRef} aria-label={label} className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <LeaderboardRowCard entry={entry} statHeaders={statHeaders} gridStyle={gridStyle} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
