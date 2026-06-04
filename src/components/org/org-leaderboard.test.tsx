import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrgLeaderboard } from "@/components/org/org-leaderboard";

const ROWS = [
  { catId: "c1", name: "Top Cat", slug: "top-cat-1", score: 1200, wins: 9, losses: 1 },
  { catId: "c2", name: "Mid Cat", slug: "mid-cat-1", score: 900, wins: 5, losses: 5 },
];

describe("OrgLeaderboard", () => {
  it("renders one item per member with name, score and a link, in order", () => {
    render(<OrgLeaderboard rows={ROWS} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    const [firstItem, secondItem] = items as [HTMLElement, HTMLElement];
    expect(within(firstItem).getByText("Top Cat")).toBeInTheDocument();
    expect(within(firstItem).getByText("1200")).toBeInTheDocument();
    expect(within(firstItem).getByRole("link")).toHaveAttribute("href", "/cat/top-cat-1");
    expect(within(secondItem).getByText("Mid Cat")).toBeInTheDocument();
  });

  it("shows an empty state when there are no members", () => {
    render(<OrgLeaderboard rows={[]} />);
    expect(screen.getByText(/no cats yet/i)).toBeInTheDocument();
  });
});
