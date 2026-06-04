import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { LeaderboardEntry } from "@/components/ui/leaderboard";
import { VirtualLeaderboard } from "@/components/ui/virtual-leaderboard";

const ENTRIES: LeaderboardEntry[] = [
  { id: "a", rank: 1, name: "Mochi", href: "/cat/mochi", stats: ["1820", "41/11"] },
  { id: "b", rank: 2, name: "Pixel", href: "/cat/pixel", stats: ["1690", "29/16"] },
  { id: "c", rank: 3, name: "Biscuit", href: "/cat/biscuit", stats: ["1605", "22/16"] },
];

const STAT_HEADERS = ["Score", "W/L"];

function renderBoard() {
  return render(
    <VirtualLeaderboard label="Top cats" statHeaders={STAT_HEADERS} entries={ENTRIES} />,
  );
}

describe("VirtualLeaderboard", () => {
  it("renders an accessible ordered list with every (visible) entry", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Top cats" })).toBeInTheDocument();
    // The short list fits the viewport, so all rows render in either branch.
    expect(screen.getAllByRole("listitem")).toHaveLength(ENTRIES.length);
    for (const entry of ENTRIES) {
      expect(screen.getByText(entry.name)).toBeInTheDocument();
    }
  });

  it("renders the column headers and links each row to its cat page", () => {
    renderBoard();

    expect(screen.getByText("Score")).toBeInTheDocument();
    expect(screen.getByText("W/L")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /Mochi/ });
    expect(link).toHaveAttribute("href", "/cat/mochi");
  });
});
