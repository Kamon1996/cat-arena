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
    initialAreaPixels,
  }: {
    file: File | null;
    onCropped: (f: File, crop: typeof STUB_AREA) => void;
    onUseOriginal: (f: File) => void;
    onCancel: () => void;
    initialAreaPixels?: typeof STUB_AREA | null;
  }) =>
    file ? (
      <div data-testid="crop-dialog">
        <span data-testid="crop-file-name">{file.name}</span>
        <span data-testid="crop-initial">{JSON.stringify(initialAreaPixels ?? null)}</span>
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

describe("ImageDropzone re-crop", () => {
  it("re-opens the dialog from a tile and updates only the rect, keeping the id", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { container } = render(<Harness onPick={onPick} />);

    pickFiles(container, [pngFile("a.png")]);
    await user.click(screen.getByRole("button", { name: "stub-keep" }));
    const initial = (onPick.mock.calls.at(-1)?.[0] as PickedPhoto[])[0];

    await user.click(screen.getByRole("button", { name: /adjust crop of a\.png/i }));
    expect(screen.getByTestId("crop-file-name")).toHaveTextContent("a.png");
    await user.click(screen.getByRole("button", { name: "stub-crop" }));

    const updated = onPick.mock.calls.at(-1)?.[0] as PickedPhoto[];
    expect(updated).toHaveLength(1);
    expect(updated[0]?.crop).toEqual(STUB_AREA);
    // Same photo id — the eager upload must NOT restart for a rect change.
    expect(updated[0]?.id).toBe(initial?.id);
  });

  it("restores the existing rect into the dialog for adjustment", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);

    pickFiles(container, [pngFile("a.png")]);
    await user.click(screen.getByRole("button", { name: "stub-crop" }));

    await user.click(screen.getByRole("button", { name: /adjust crop of a\.png/i }));
    expect(screen.getByTestId("crop-initial")).toHaveTextContent(JSON.stringify(STUB_AREA));
  });

  it("keeps the photo untouched when the re-crop dialog is dismissed", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const { container } = render(<Harness onPick={onPick} />);

    pickFiles(container, [pngFile("a.png")]);
    await user.click(screen.getByRole("button", { name: "stub-keep" }));
    const callsAfterPick = onPick.mock.calls.length;

    await user.click(screen.getByRole("button", { name: /adjust crop of a\.png/i }));
    await user.click(screen.getByRole("button", { name: "stub-cancel" }));

    expect(screen.getByAltText(/preview of a\.png/i)).toBeInTheDocument();
    expect(onPick.mock.calls.length).toBe(callsAfterPick);
  });
});

describe("ImageDropzone upload states", () => {
  function photo(name: string): PickedPhoto {
    return { id: `id-${name}`, file: pngFile(name), crop: null };
  }

  it("shows a live progress bar while a photo uploads", () => {
    const p = photo("a.png");
    render(
      <ImageDropzone
        files={[p]}
        onChange={vi.fn()}
        uploads={{ [p.id]: { status: "uploading", progress: 45, r2Key: null, error: null } }}
      />,
    );
    expect(screen.getByRole("progressbar", { name: /uploading a\.png/i })).toHaveAttribute(
      "aria-valuenow",
      "45",
    );
  });

  it("shows the per-photo error with a Retry action", async () => {
    const user = userEvent.setup();
    const onRetryUpload = vi.fn();
    const p = photo("a.png");
    render(
      <ImageDropzone
        files={[p]}
        onChange={vi.fn()}
        uploads={{
          [p.id]: {
            status: "error",
            progress: 0,
            r2Key: null,
            error: "This photo has already been uploaded",
          },
        }}
        onRetryUpload={onRetryUpload}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/already been uploaded/i);
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetryUpload).toHaveBeenCalledWith(p);
  });

  it("marks a finished photo as uploaded", () => {
    const p = photo("a.png");
    render(
      <ImageDropzone
        files={[p]}
        onChange={vi.fn()}
        uploads={{
          [p.id]: { status: "uploaded", progress: 100, r2Key: "cats/x/original", error: null },
        }}
      />,
    );
    expect(screen.getByText("Uploaded")).toBeInTheDocument();
  });
});
