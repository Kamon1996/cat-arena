import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    expect(screen.queryByRole("button", { name: /next image/i })).not.toBeInTheDocument();
  });

  it("advances to the next image when there are multiple", async () => {
    const user = userEvent.setup();
    render(<CatImageCarousel name="Alpha" images={twoImages} />);
    expect(screen.getByRole("img", { name: /alpha/i })).toHaveAttribute("src", "/a.webp");
    await user.click(screen.getByRole("button", { name: /next image/i }));
    expect(screen.getByRole("img", { name: /alpha/i })).toHaveAttribute("src", "/b.webp");
  });
});
