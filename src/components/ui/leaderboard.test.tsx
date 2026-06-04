import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Leaderboard, type LeaderboardEntry } from "@/components/ui/leaderboard";

const ENTRIES: LeaderboardEntry[] = [
  { id: "a", rank: 1, name: "Mochi", href: "/cat/mochi", stats: ["1820", "78%"] },
  { id: "b", rank: 2, name: "Pixel", stats: ["1690", "64%"] },
];

const STAT_HEADERS = ["Rating", "Win rate"];

function renderBoard() {
  return render(<Leaderboard label="Top cats" statHeaders={STAT_HEADERS} entries={ENTRIES} />);
}

describe("Leaderboard", () => {
  it("renders an accessible ordered list with one item per entry", () => {
    renderBoard();

    expect(screen.getByRole("list", { name: "Top cats" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(ENTRIES.length);
  });

  it("renders the column headers and stat values", () => {
    renderBoard();

    expect(screen.getByText("Rating")).toBeInTheDocument();
    expect(screen.getByText("Win rate")).toBeInTheDocument();
    expect(screen.getByText("1820")).toBeInTheDocument();
    expect(screen.getByText("64%")).toBeInTheDocument();
  });

  it("links a row when it has an href and leaves others plain", () => {
    renderBoard();

    const link = screen.getByRole("link", { name: /Mochi/ });
    expect(link).toHaveAttribute("href", "/cat/mochi");

    expect(screen.getByText("Pixel")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Pixel/ })).not.toBeInTheDocument();
  });
});
