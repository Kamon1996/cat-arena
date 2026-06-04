import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ModerationGalleryRow } from "@/components/admin/moderation-gallery-row";
import { approveAllAction, rejectCatImagesAction } from "@/moderation/moderation-actions";
import type { ModerationCat } from "@/moderation/moderation-types";

vi.mock("@/moderation/moderation-actions", () => ({
  approveAllAction: vi.fn(() => Promise.resolve({ ok: true })),
  rejectCatImagesAction: vi.fn(() => Promise.resolve({ ok: true })),
  hideCatAction: vi.fn(() => Promise.resolve({ ok: true })),
  banCatAction: vi.fn(() => Promise.resolve({ ok: true })),
  deleteCatAction: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("@/admin/user-actions", () => ({
  banUser: vi.fn(() => Promise.resolve({ ok: true })),
  setUserRole: vi.fn(() => Promise.resolve({ ok: true })),
}));

const CAT: ModerationCat = {
  id: "cat_1",
  name: "Mochi",
  status: "PENDING",
  createdAt: "2026-06-04T12:00:00.000Z",
  owner: { id: "u1", name: "Aiko", email: "aiko@cats.io", role: "USER", banned: false },
  images: [{ id: "i1", thumbUrl: "/thumb.webp", width: 1080, height: 1080 }],
};

function renderRow(onResolved = vi.fn()) {
  render(
    <ModerationGalleryRow
      cat={CAT}
      isAdmin={false}
      currentUserId="admin"
      onResolved={onResolved}
      onOwnerResolved={vi.fn()}
      onOwnerRoleChanged={vi.fn()}
    />,
  );
  return onResolved;
}

describe("ModerationGalleryRow", () => {
  it("approves all images and resolves the row", async () => {
    const user = userEvent.setup();
    const onResolved = renderRow();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(approveAllAction).toHaveBeenCalledWith("cat_1");
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("cat_1"));
  });

  it("rejects all images with the chosen reasons via the modal", async () => {
    const user = userEvent.setup();
    const onResolved = renderRow();

    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(await screen.findByRole("button", { name: "Inappropriate" }));
    await user.click(screen.getByRole("button", { name: /reject · 1/i }));

    expect(rejectCatImagesAction).toHaveBeenCalledWith("cat_1", ["Inappropriate"]);
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith("cat_1"));
  });
});
