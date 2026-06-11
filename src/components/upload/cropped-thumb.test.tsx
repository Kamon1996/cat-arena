import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CroppedThumb } from "./cropped-thumb";

const CROP = { x: 10, y: 20, width: 50, height: 50 };

function loadAs(img: HTMLElement, naturalWidth: number, naturalHeight: number): void {
  Object.defineProperty(img, "naturalWidth", { value: naturalWidth, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: naturalHeight, configurable: true });
  fireEvent.load(img);
}

describe("CroppedThumb", () => {
  it("renders the photo as-is when there is no crop", () => {
    render(<CroppedThumb src="blob:x" crop={null} alt="Preview of a.png" />);
    expect(screen.getByAltText("Preview of a.png")).toHaveClass("object-cover");
  });

  it("scales and offsets the photo so the crop rect exactly fills the box", () => {
    render(<CroppedThumb src="blob:x" crop={CROP} alt="Preview of a.png" />);
    const img = screen.getByAltText("Preview of a.png");
    loadAs(img, 100, 200);

    // 100/50 → 200% wide, 200/50 → 400% tall; offset -10/50 → -20%, -20/50 → -40%.
    expect(img).toHaveStyle({
      width: "200%",
      height: "400%",
      left: "-20%",
      top: "-40%",
    });
  });

  it("stays hidden until the photo is measured", () => {
    render(<CroppedThumb src="blob:x" crop={CROP} alt="Preview of a.png" />);
    const img = screen.getByAltText("Preview of a.png");
    expect(img).toHaveClass("opacity-0");
    loadAs(img, 100, 100);
    expect(img).toHaveClass("opacity-100");
  });
});
