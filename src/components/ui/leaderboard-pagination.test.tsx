import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaderboardPagination } from "@/components/ui/leaderboard-pagination";

const BASE_PATH = "/top";

describe("LeaderboardPagination", () => {
  it("shows the current page, links Next, and disables Previous on page 1", () => {
    render(<LeaderboardPagination page={1} pageCount={3} basePath={BASE_PATH} />);

    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    const next = screen.getByRole("link", { name: /next/i });
    expect(next).toHaveAttribute("href", "/top?page=2");

    expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("links Previous to the clean base path on page 2 and disables Next on the last page", () => {
    render(<LeaderboardPagination page={3} pageCount={3} basePath={BASE_PATH} />);

    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();

    const prev = screen.getByRole("link", { name: /previous/i });
    expect(prev).toHaveAttribute("href", "/top?page=2");

    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("links Previous on page 2 back to page 1 as the bare base path (canonical)", () => {
    render(<LeaderboardPagination page={2} pageCount={5} basePath={BASE_PATH} />);

    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/top");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/top?page=3");
  });
});
