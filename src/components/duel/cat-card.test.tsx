import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CatCard } from "@/components/duel/cat-card";

const cat = {
  id: "ca",
  name: "Alpha",
  slug: "alpha-1",
  images: [{ url: "/a.webp", width: 800, height: 600, position: 0 }],
};

describe("CatCard", () => {
  it("shows the cat name and fires onPick when chosen", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CatCard cat={cat} side="a" state="idle" onPick={onPick} disabled={false} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pick alpha/i }));
    expect(onPick).toHaveBeenCalledWith("ca", expect.anything());
  });

  it("does not fire onPick when disabled", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<CatCard cat={cat} side="a" state="idle" onPick={onPick} disabled />);
    await user.click(screen.getByRole("button", { name: /pick alpha/i }));
    expect(onPick).not.toHaveBeenCalled();
  });
});
