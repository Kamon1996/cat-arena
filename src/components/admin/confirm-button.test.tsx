import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmButton } from "./confirm-button";

describe("ConfirmButton", () => {
  it("opens a dialog and calls onConfirm when confirmed", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmButton
        label="Ban"
        title="Ban this user?"
        description="Cats deleted."
        confirmLabel="Ban user"
        onConfirm={onConfirm}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ban" }));
    expect(screen.getByText("Ban this user?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ban user" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
