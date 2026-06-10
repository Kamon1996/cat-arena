import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CropDialog } from "@/components/upload/crop-dialog";

// A real (tiny) PNG so the cropper has decodable bytes in the story.
const PNG_2X2_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGNkYGD4z8DAwMgAAwAQAAH/Lh3xAAAAAElFTkSuQmCC";

function pngFile(): File {
  const bytes = Uint8Array.from(atob(PNG_2X2_BASE64), (char) => char.charCodeAt(0));
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
