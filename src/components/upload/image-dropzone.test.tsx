import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Stub crop dialog: visible whenever a file awaits a decision, with buttons
// that resolve the queue head the three possible ways.
const STUB_AREA = { x: 1, y: 2, width: 30, height: 30 };

vi.mock("@/components/upload/crop-dialog", () => ({
  CropDialog: ({
    file,
    onCropped,
    onUseOriginal,
    onCancel,
  }: {
    file: File | null;
    onCropped: (f: File, crop: typeof STUB_AREA) => void;
    onUseOriginal: (f: File) => void;
    onCancel: () => void;
  }) =>
    file ? (
      <div data-testid="crop-dialog">
        <span data-testid="crop-file-name">{file.name}</span>
        <button type="button" onClick={() => onCropped(file, STUB_AREA)}>
          stub-crop
        </button>
        <button type="button" onClick={() => onUseOriginal(file)}>
          stub-keep
        </button>
        <button type="button" onClick={onCancel}>
          stub-cancel
        </button>
      </div>
    ) : null,
}));

import { ImageDropzone, type PickedPhoto } from "./image-dropzone";

function pngFile(name: string): File {
  return new File(["bytes"], name, { type: "image/png" });
}

function Harness({ onPick }: { onPick?: (photos: PickedPhoto[]) => void }) {
  const [files, setFiles] = useState<PickedPhoto[]>([]);
  return (
    <ImageDropzone
      files={files}
      onChange={(next) => {
        onPick?.(next);
        setFiles(next);
      }}
    />
  );
}

function pickFiles(container: HTMLElement, files: File[]): void {
  const input = container.querySelector('input[type="file"]');
  if (!input) {
    throw new Error("file input not rendered");
  }
  fireEvent.change(input, { target: { files } });
}

beforeAll(() => {
  // jsdom does not implement object URLs (used by the preview grid).
  Object.assign(URL, {
    createObjectURL: vi.fn(() => "blob:mock"),
    revokeObjectURL: vi.fn(),
  });
});

describe("ImageDropzone crop queue", () => {
  it("routes a picked file through the crop dialog before listing it", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    pickFiles(container, [pngFile("a.png")]);

    // Queued for cropping, NOT yet in the preview list.
    expect(screen.getByTestId("crop-file-name")).toHaveTextContent("a.png");
    expect(screen.queryByAltText(/preview of a\.png/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "stub-keep" }));

    expect(screen.queryByTestId("crop-dialog")).not.toBeInTheDocument();
    expect(screen.getByAltText(/preview of a\.png/i)).toBeInTheDocument();
  });

  it("processes multiple picked files one at a time", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    pickFiles(container, [pngFile("a.png"), pngFile("b.png")]);

    expect(screen.getByTestId("crop-file-name")).toHaveTextContent("a.png");
    await user.click(screen.getByRole("button", { name: "stub-crop" }));

    expect(screen.getByTestId("crop-file-name")).toHaveTextContent("b.png");
    await user.click(screen.getByRole("button", { name: "stub-crop" }));

    expect(screen.queryByTestId("crop-dialog")).not.toBeInTheDocument();
    expect(screen.getByAltText(/preview of a\.png/i)).toBeInTheDocument();
    expect(screen.getByAltText(/preview of b\.png/i)).toBeInTheDocument();
  });

  it("drops the file entirely on cancel", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    pickFiles(container, [pngFile("a.png")]);
    await user.click(screen.getByRole("button", { name: "stub-cancel" }));

    expect(screen.queryByTestId("crop-dialog")).not.toBeInTheDocument();
    expect(screen.queryByAltText(/preview of a\.png/i)).not.toBeInTheDocument();
  });

  it("ignores a re-pick of a file that is already listed", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    const same = pngFile("a.png");
    pickFiles(container, [same]);
    await user.click(screen.getByRole("button", { name: "stub-keep" }));
    expect(screen.getByAltText(/preview of a\.png/i)).toBeInTheDocument();

    pickFiles(container, [same]);
    expect(screen.queryByTestId("crop-dialog")).not.toBeInTheDocument();
  });
});
