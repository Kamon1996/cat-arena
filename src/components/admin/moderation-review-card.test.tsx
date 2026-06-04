import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ModerationReviewCard } from "@/components/admin/moderation-review-card";

const IMAGES = [{ filename: "IMG_1", dimensions: "1080×1350" }];

describe("ModerationReviewCard", () => {
  it("locks Reject until a flag is set, then reports the issue count", async () => {
    const user = userEvent.setup();
    const onReject = vi.fn();
    render(<ModerationReviewCard catName="Mochi" images={IMAGES} onReject={onReject} />);

    expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Blurry / low-res" }));
    expect(screen.getByRole("button", { name: /reject · 1 issue/i })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Not a cat" }));
    const reject = screen.getByRole("button", { name: /reject · 2 issues/i });
    expect(reject).toBeEnabled();

    await user.click(reject);
    expect(onReject).toHaveBeenCalledWith(["Blurry / low-res", "Not a cat"]);
  });

  it("approves via the Approve button", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<ModerationReviewCard catName="Mochi" images={IMAGES} onApprove={onApprove} />);

    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(onApprove).toHaveBeenCalledOnce();
  });
});
