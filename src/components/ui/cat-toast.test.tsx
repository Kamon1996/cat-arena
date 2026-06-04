import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";

import { CatToast, catToast } from "@/components/ui/cat-toast";
import { CAT_TOAST_DURATION_MS } from "@/lib/constants";

describe("CatToast", () => {
  it("renders the title and message, with a polite status role on success", () => {
    render(<CatToast id="t1" tone="success" title="Vote counted" message="Mochi +12!" />);

    const card = screen.getByRole("status");
    expect(card).toHaveTextContent("Vote counted");
    expect(card).toHaveTextContent("Mochi +12!");
  });

  it("uses an assertive alert role on error", () => {
    render(<CatToast id="t2" tone="error" title="Photo rejected" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Photo rejected");
  });

  it("fires the action then dismisses the toast", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const dismiss = vi.spyOn(toast, "dismiss");

    render(<CatToast id="t3" title="Vote counted" action={{ label: "Undo", onClick }} />);

    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(dismiss).toHaveBeenCalledWith("t3");
    dismiss.mockRestore();
  });

  it("dismisses via the close button and hides it when not dismissible", async () => {
    const user = userEvent.setup();
    const dismiss = vi.spyOn(toast, "dismiss");

    const { rerender } = render(<CatToast id="t4" title="Saved" />);
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(dismiss).toHaveBeenCalledWith("t4");

    rerender(<CatToast id="t4" title="Saved" dismissible={false} />);
    expect(screen.queryByRole("button", { name: "Dismiss" })).not.toBeInTheDocument();
    dismiss.mockRestore();
  });

  it("renders the mascot variant on error without an action", () => {
    render(<CatToast id="t5" variant="mascot" tone="error" title="Photo rejected" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Photo rejected");
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });
});

describe("catToast", () => {
  it("fires a success toast through toast.custom with the default duration", () => {
    const custom = vi.spyOn(toast, "custom");

    catToast.success("Saved", { message: "ok" });

    expect(custom).toHaveBeenCalledOnce();
    const [renderToast, options] = custom.mock.calls[0] ?? [];
    expect(options?.duration).toBe(CAT_TOAST_DURATION_MS);

    // The render callback produces the success card.
    render((renderToast as (id: string) => ReactElement)("tid"));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

    custom.mockRestore();
  });

  it("maps duration 0 to a sticky (infinite) toast and resets the inherited chrome", () => {
    const custom = vi.spyOn(toast, "custom");

    catToast.show({ title: "Live!", duration: 0 });

    const options = custom.mock.calls[0]?.[1];
    expect(options?.duration).toBe(Number.POSITIVE_INFINITY);
    expect(options?.style).toMatchObject({ border: "none", boxShadow: "none" });

    custom.mockRestore();
  });

  it("fires confetti only on mascot-success ('auto'), and on explicit confetti:true", () => {
    const custom = vi.spyOn(toast, "custom");
    const confettiFor = (options: Parameters<typeof catToast.show>[0]): boolean => {
      custom.mockClear();
      catToast.show(options);
      const renderToast = custom.mock.calls[0]?.[0] as (id: string) => ReactElement;
      const element = renderToast("id");
      return Boolean((element.props as { confetti?: boolean }).confetti);
    };

    expect(confettiFor({ title: "x", tone: "success", variant: "mascot" })).toBe(true);
    expect(confettiFor({ title: "x", tone: "success", variant: "sticker" })).toBe(false);
    expect(confettiFor({ title: "x", tone: "error", variant: "mascot" })).toBe(false);
    expect(confettiFor({ title: "x", tone: "success", variant: "sticker", confetti: true })).toBe(
      true,
    );

    custom.mockRestore();
  });
});
