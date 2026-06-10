import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/cats/owner-actions", () => ({
  addCatImage: vi.fn(async () => ({ ok: true })),
  deleteCatImage: vi.fn(async () => ({ ok: true })),
  deleteCatOwned: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/components/upload/upload-to-r2", () => ({
  uploadToR2: vi.fn(async () => ({ r2Key: "cats/new/original" })),
}));

import type { CatCardData, CatCardImage } from "./cat-card";
import { CatCard } from "./cat-card";

function photo(id: string, status: string, rejectionReasons: string[] = []): CatCardImage {
  return {
    id,
    status,
    rejectionReasons,
    width: 800,
    height: 600,
    thumbUrl: `https://cdn.test/${id}/thumb.webp`,
    fullUrl: `https://cdn.test/${id}/card.webp`,
  };
}

const BASE_CAT: CatCardData = {
  id: "cat_1",
  name: "Molly",
  status: "ACTIVE",
  rank: 3,
  score: 1409,
  rating: 1734,
  rd: 40,
  wins: 5,
  losses: 1,
  timesShown: 6,
  images: [photo("a", "APPROVED"), photo("b", "PENDING"), photo("c", "REJECTED", ["Too blurry"])],
};

describe("CatCard (scrapbook)", () => {
  it("shows the rank medallion for a ranked cat and no unranked chip", () => {
    render(<CatCard cat={BASE_CAT} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.queryByText("unranked")).not.toBeInTheDocument();
  });

  it("shows the unranked chip instead of a medallion when rank is null", () => {
    render(<CatCard cat={{ ...BASE_CAT, rank: null }} />);
    expect(screen.queryByText(/#\d/)).not.toBeInTheDocument();
    expect(screen.getByText("unranked")).toBeInTheDocument();
  });

  it("captions each print with its photo status", () => {
    render(<CatCard cat={BASE_CAT} />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("In review")).toBeInTheDocument();
    // Stamp + caption label both say Rejected.
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
  });

  it("offers Replace only on the rejected print", () => {
    render(<CatCard cat={BASE_CAT} />);
    expect(screen.getAllByRole("button", { name: /replace/i })).toHaveLength(1);
  });

  it("shows the empty Add-photo slot while under the photo cap", () => {
    render(<CatCard cat={{ ...BASE_CAT, images: [photo("a", "APPROVED")] }} />);
    expect(screen.getByText(/add photo/i)).toBeInTheDocument();
    expect(screen.getByText("1 of 3 photos")).toBeInTheDocument();
  });

  it("hides the slot at the cap and counts 3 of 3", () => {
    render(<CatCard cat={BASE_CAT} />);
    expect(screen.queryByText(/add photo/i)).not.toBeInTheDocument();
    expect(screen.getByText("3 of 3 photos")).toBeInTheDocument();
  });

  it("renders a banned cat read-only: no remove/replace/add/delete", () => {
    render(<CatCard cat={{ ...BASE_CAT, rank: null, status: "BANNED" }} />);
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /remove this photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /replace/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/add photo/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete cat/i })).not.toBeInTheDocument();
  });

  it("opens the lightbox at the clicked print and flips with the arrows", async () => {
    const user = userEvent.setup();
    render(<CatCard cat={BASE_CAT} />);

    await user.click(screen.getAllByRole("button", { name: /view original/i })[1] as HTMLElement);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/02 \/ 03/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /next photo/i }));
    expect(within(dialog).getByText(/03 \/ 03/)).toBeInTheDocument();

    // Looping: next from the last photo wraps to the first.
    await user.click(within(dialog).getByRole("button", { name: /next photo/i }));
    expect(within(dialog).getByText(/01 \/ 03/)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
