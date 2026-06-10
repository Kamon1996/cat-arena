import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CropDialog } from "@/components/upload/crop-dialog";

// A real (tiny) PNG fallback so the args stay valid outside a browser context.
const PNG_2X2_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNkYGD4z8DAwMgAAwAQAAH/Lh3xAAAAAElFTkSuQmCC";

const FAKE_PHOTO_WIDTH = 600;
const FAKE_PHOTO_HEIGHT = 800; // portrait — the shape that exposed the old objectFit bug

/** Draw a portrait "cat photo" stand-in so the cropper has real pixels to pan/zoom. */
function pngFile(): File {
  if (typeof document === "undefined") {
    const bytes = Uint8Array.from(atob(PNG_2X2_BASE64), (char) => char.charCodeAt(0));
    return new File([bytes], "mimo.png", { type: "image/png" });
  }
  const canvas = document.createElement("canvas");
  canvas.width = FAKE_PHOTO_WIDTH;
  canvas.height = FAKE_PHOTO_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, FAKE_PHOTO_HEIGHT);
    sky.addColorStop(0, "#fcd34d");
    sky.addColorStop(1, "#f97316");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, FAKE_PHOTO_WIDTH, FAKE_PHOTO_HEIGHT);
    // "Cat": dark blob + ears so framing/zooming has a clear subject.
    ctx.fillStyle = "#1f2937";
    ctx.beginPath();
    ctx.arc(300, 430, 150, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(190, 340);
    ctx.lineTo(230, 220);
    ctx.lineTo(290, 310);
    ctx.moveTo(410, 340);
    ctx.lineTo(370, 220);
    ctx.lineTo(310, 310);
    ctx.fill();
  }
  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return new File([bytes], "mimo.png", { type: "image/png" });
}

const meta = {
  title: "Upload/CropDialog",
  component: CropDialog,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    file: pngFile(),
    onCropped: fn(),
    onUseOriginal: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof CropDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Closed: Story = {
  args: { file: null },
};
