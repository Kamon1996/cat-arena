import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

const FIXED_AREA = { x: 0, y: 0, width: 100, height: 100 };

// The dialog's props to the cropper, captured for assertions.
const cropperProps: { current: Record<string, unknown> | null } = { current: null };

// Stub cropper: reports a fixed pixel area on mount so the confirm button
// becomes enabled without real layout or gestures (jsdom has neither).
vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  return {
    default: (
      props: { onCropComplete: (area: unknown, pixels: unknown) => void } & Record<string, unknown>,
    ) => {
      cropperProps.current = props;
      useEffect(() => {
        props.onCropComplete(FIXED_AREA, FIXED_AREA);
      }, [props.onCropComplete]);
      return <div data-testid="cropper" />;
    },
  };
});

import { CropDialog } from "./crop-dialog";

const ORIGINAL = new File(["original"], "cat.png", { type: "image/png" });

beforeAll(() => {
  // jsdom does not implement object URLs.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
});

describe("CropDialog", () => {
  it("renders nothing when no file awaits a decision", () => {
    render(
      <CropDialog file={null} onCropped={vi.fn()} onUseOriginal={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByText(/frame your cat/i)).not.toBeInTheDocument();
  });

  it("defers mounting the cropper until the dialog's open animation settles", async () => {
    const { baseElement } = render(
      <CropDialog file={ORIGINAL} onCropped={vi.fn()} onUseOriginal={vi.fn()} onCancel={vi.fn()} />,
    );

    // Mounting mid-animation would make the cropper measure a scaled container;
    // meanwhile a static contain preview of the photo fills the square instead
    // of a white flash.
    expect(screen.queryByTestId("cropper")).not.toBeInTheDocument();
    expect(baseElement.querySelector("img")).toBeInTheDocument();
    expect(await screen.findByTestId("cropper")).toBeInTheDocument();
  });

  it("hands back the UNTOUCHED original plus the chosen rect on confirm", async () => {
    const onCropped = vi.fn();
    const user = userEvent.setup();
    render(
      <CropDialog
        file={ORIGINAL}
        onCropped={onCropped}
        onUseOriginal={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const confirm = await screen.findByRole("button", { name: /use this crop/i });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(onCropped).toHaveBeenCalledWith(ORIGINAL, FIXED_AREA);
  });

  it("passes the original through without a rect on 'Keep original'", async () => {
    const onUseOriginal = vi.fn();
    const user = userEvent.setup();
    render(
      <CropDialog
        file={ORIGINAL}
        onCropped={vi.fn()}
        onUseOriginal={onUseOriginal}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /keep original/i }));
    expect(onUseOriginal).toHaveBeenCalledWith(ORIGINAL);
  });

  it("restores the previous framing in re-crop mode", async () => {
    const initial = { x: 5, y: 6, width: 40, height: 40 };
    render(
      <CropDialog
        file={ORIGINAL}
        initialAreaPixels={initial}
        onCropped={vi.fn()}
        onUseOriginal={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await screen.findByTestId("cropper");
    expect(cropperProps.current?.initialCroppedAreaPixels).toEqual(initial);
  });
});
