import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CatCell } from "@/components/ui/cat-cell";

describe("CatCell", () => {
  it("shows the name and handle", () => {
    render(<CatCell name="Mochi" handle="@mochi" />);

    expect(screen.getByText("Mochi")).toBeInTheDocument();
    expect(screen.getByText("@mochi")).toBeInTheDocument();
  });

  it("omits the handle line when none is given", () => {
    render(<CatCell name="Pixel" />);

    expect(screen.getByText("Pixel")).toBeInTheDocument();
    expect(screen.queryByText("@", { exact: false })).not.toBeInTheDocument();
  });
});
