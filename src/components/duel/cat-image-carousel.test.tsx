import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatImageCarousel } from "@/components/duel/cat-image-carousel";

const oneImage = [{ url: "/a.webp", width: 800, height: 600, position: 0 }];
const twoImages = [
  { url: "/a.webp", width: 800, height: 600, position: 0 },
  { url: "/b.webp", width: 800, height: 600, position: 1 },
];

describe("CatImageCarousel", () => {
  it("renders a single image with no navigation controls", () => {
    render(<CatImageCarousel name="Alpha" images={oneImage} />);
    expect(screen.getByRole("img", { name: /alpha/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
  });

  it("renders every slide plus prev/next controls when there are multiple", () => {
    render(<CatImageCarousel name="Alpha" images={twoImages} />);
    // Embla mounts all slides at once (it translates the track), so both images render.
    expect(screen.getAllByRole("img", { name: /alpha/i })).toHaveLength(2);
    expect(screen.getByRole("button", { name: /previous photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next photo/i })).toBeInTheDocument();
  });
});
