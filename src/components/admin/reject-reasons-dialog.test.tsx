import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RejectReasonsDialog } from "@/components/admin/reject-reasons-dialog";

describe("RejectReasonsDialog", () => {
  it("enables Reject only after a reason is chosen and reports the selection", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RejectReasonsDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} catName="Mochi" />,
    );

    expect(screen.getByRole("button", { name: /^reject$/i })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Blurry / low-res" }));
    await user.click(screen.getByRole("button", { name: "Duplicate" }));

    const reject = screen.getByRole("button", { name: /reject · 2/i });
    expect(reject).toBeEnabled();

    await user.click(reject);
    expect(onConfirm).toHaveBeenCalledWith(["Blurry / low-res", "Duplicate"]);
  });
});
