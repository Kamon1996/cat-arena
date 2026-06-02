import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SiteHeader } from "./site-header";

const EXPECTED_TITLE = "Cat Arena";

describe("SiteHeader", () => {
  it("renders the site title as a banner heading", () => {
    render(<SiteHeader />);
    const banner = screen.getByRole("banner");
    expect(banner).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: EXPECTED_TITLE })).toBeInTheDocument();
  });
});
