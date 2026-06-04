import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatDetail } from "@/components/cat/cat-detail";
import type { CatPage } from "@/data/cat-page";

const CAT: CatPage = {
  id: "ca",
  name: "Fluffy",
  slug: "fluffy-1",
  rating: 1600,
  rd: 80,
  score: 1440,
  wins: 12,
  losses: 4,
  rank: 8,
  images: [
    { url: "https://cdn.test/cats/a/card.webp", width: 800, height: 600 },
    { url: "https://cdn.test/cats/b/card.webp", width: 800, height: 600 },
  ],
  recentDuels: [
    { id: "v1", won: true },
    { id: "v2", won: false },
  ],
};

describe("CatDetail", () => {
  it("renders the name as the single h1 with rank and W/L", () => {
    render(<CatDetail cat={CAT} />);
    expect(screen.getByRole("heading", { level: 1, name: "Fluffy" })).toBeInTheDocument();
    expect(screen.getByText(/#8/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("gives every gallery image descriptive alt text", () => {
    render(<CatDetail cat={CAT} />);
    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img).toHaveAttribute("alt", expect.stringMatching(/fluffy/i));
    }
  });

  it("lists recent duels", () => {
    render(<CatDetail cat={CAT} />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });
});
