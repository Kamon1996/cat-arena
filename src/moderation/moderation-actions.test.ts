import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireModeratorMock,
  approveImage,
  rejectImage,
  approveCatImages,
  hideCat,
  banCat,
  deleteCat,
} = vi.hoisted(() => ({
  requireModeratorMock: vi.fn(),
  approveImage: vi.fn(),
  rejectImage: vi.fn(),
  approveCatImages: vi.fn(),
  hideCat: vi.fn(),
  banCat: vi.fn(),
  deleteCat: vi.fn(),
}));

vi.mock("@/auth/guards", () => ({ requireModerator: requireModeratorMock }));
vi.mock("@/moderation/admin-actions", () => ({
  approveImage,
  rejectImage,
  approveCatImages,
  hideCat,
  banCat,
  deleteCat,
}));

import {
  approveAllAction,
  approveImageAction,
  banCatAction,
  deleteCatAction,
  hideCatAction,
  rejectImageAction,
} from "./moderation-actions";

describe("moderation-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireModeratorMock.mockResolvedValue({ user: { id: "m", role: "MODERATOR" } });
  });

  it("guards then runs the action and returns ok", async () => {
    const res = await approveImageAction("img_1");
    expect(requireModeratorMock).toHaveBeenCalledOnce();
    expect(approveImage).toHaveBeenCalledWith("img_1");
    expect(res).toEqual({ ok: true });
  });

  it("maps the cat-level actions to their admin-action", async () => {
    await rejectImageAction("img_2");
    expect(rejectImage).toHaveBeenCalledWith("img_2");
    await approveAllAction("cat_1");
    expect(approveCatImages).toHaveBeenCalledWith("cat_1");
    await hideCatAction("cat_1");
    expect(hideCat).toHaveBeenCalledWith("cat_1");
    await banCatAction("cat_1");
    expect(banCat).toHaveBeenCalledWith("cat_1");
    await deleteCatAction("cat_1");
    expect(deleteCat).toHaveBeenCalledWith("cat_1");
  });

  it("returns ok:false when the mutation throws", async () => {
    approveImage.mockRejectedValueOnce(new Error("db"));
    const res = await approveImageAction("img_x");
    expect(res).toEqual({ ok: false, error: "failed" });
  });
});
