import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { cropMock } = vi.hoisted(() => ({ cropMock: vi.fn() }));

const FIXED_AREA = { x: 0, y: 0, width: 100, height: 100 };

// Stub cropper: reports a fixed pixel area on mount so the confirm button
// becomes enabled without real layout or gestures (jsdom has neither).
vi.mock("react-easy-crop", async () => {
  const { useEffect } = await import("react");
  return {
    default: ({ onCropComplete }: { onCropComplete: (area: unknown, pixels: unknown) => void }) => {
      useEffect(() => {
        onCropComplete(FIXED_AREA, FIXED_AREA);
      }, [onCropComplete]);
      return <div data-testid="cropper" />;
    },
  };
});

vi.mock("@/lib/crop-image", () => ({ cropImageToFile: cropMock }));

import { CropDialog } from "./crop-dialog";

const ORIGINAL = new File(["original"], "cat.png", { type: "image/png" });
const CROPPED = new File(["cropped"], "cat.webp", { type: "image/webp" });

beforeAll(() => {
  // jsdom does not implement object URLs.
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
});

describe("CropDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cropMock.mockResolvedValue(CROPPED);
  });

  it("renders nothing when no file awaits a decision", () => {
    render(
      <CropDialog file={null} onCropped={vi.fn()} onUseOriginal={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByText(/frame your cat/i)).not.toBeInTheDocument();
  });

  it("crops the file and hands the result back", async () => {
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

    await user.click(await screen.findByRole("button", { name: /use this crop/i }));

    await waitFor(() => expect(onCropped).toHaveBeenCalledWith(CROPPED));
    expect(cropMock).toHaveBeenCalledWith(ORIGINAL, FIXED_AREA);
  });

  it("passes the untouched original through on 'Keep original'", async () => {
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
    expect(cropMock).not.toHaveBeenCalled();
  });

  it("falls back to the original when cropping fails", async () => {
    cropMock.mockRejectedValueOnce(new Error("canvas exploded"));
    const onUseOriginal = vi.fn();
    const onCropped = vi.fn();
    const user = userEvent.setup();
    render(
      <CropDialog
        file={ORIGINAL}
        onCropped={onCropped}
        onUseOriginal={onUseOriginal}
        onCancel={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: /use this crop/i }));

    await waitFor(() => expect(onUseOriginal).toHaveBeenCalledWith(ORIGINAL));
    expect(onCropped).not.toHaveBeenCalled();
  });
});
