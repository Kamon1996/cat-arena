import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OrgLeaderboard } from "@/components/org/org-leaderboard";

const ROWS = [
  { catId: "c1", name: "Top Cat", slug: "top-cat-1", score: 1200, wins: 9, losses: 1 },
  { catId: "c2", name: "Mid Cat", slug: "mid-cat-1", score: 900, wins: 5, losses: 5 },
];

describe("OrgLeaderboard", () => {
  it("renders one row per member with rank, name, and score in order", () => {
    render(<OrgLeaderboard rows={ROWS} />);
    const dataRows = screen.getAllByRole("row").slice(1); // skip header row
    expect(dataRows).toHaveLength(2);
    const [firstRow, secondRow] = dataRows as [HTMLElement, HTMLElement];
    expect(within(firstRow).getByText("Top Cat")).toBeInTheDocument();
    expect(within(firstRow).getByText("1200")).toBeInTheDocument();
    expect(within(secondRow).getByText("Mid Cat")).toBeInTheDocument();
  });

  it("shows an empty state when there are no members", () => {
    render(<OrgLeaderboard rows={[]} />);
    expect(screen.getByText(/no cats yet/i)).toBeInTheDocument();
  });
});
