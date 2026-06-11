import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { ImageDropzone, type PickedPhoto } from "@/components/upload/image-dropzone";

// A real decodable 1×1 PNG so object-URL previews render in the browser.
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABijPjAAAAAElFTkSuQmCC",
  ),
  (c) => c.charCodeAt(0),
);

function demoPhoto(id: string, name: string): PickedPhoto {
  return { id, file: new File([TINY_PNG], name, { type: "image/png" }), crop: null };
}

const meta = {
  title: "Upload/ImageDropzone",
  component: ImageDropzone,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { files: [], onChange: fn(), disabled: false, uploads: {}, onRetryUpload: fn() },
  render: (args) => {
    const [files, setFiles] = useState<PickedPhoto[]>(args.files);
    return (
      <div className="w-96">
        <ImageDropzone
          files={files}
          onChange={(next) => {
            args.onChange(next);
            setFiles(next);
          }}
          disabled={args.disabled ?? false}
          uploads={args.uploads ?? {}}
          onRetryUpload={args.onRetryUpload ?? fn()}
        />
      </div>
    );
  },
} satisfies Meta<typeof ImageDropzone>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};

/** The three eager-upload tile states: in progress, failed (with Retry), done. */
export const UploadStates: Story = {
  args: {
    files: [
      demoPhoto("u1", "uploading.png"),
      demoPhoto("u2", "failed.png"),
      demoPhoto("u3", "done.png"),
    ],
    uploads: {
      u1: { status: "uploading", progress: 45, r2Key: null, error: null },
      u2: {
        status: "error",
        progress: 0,
        r2Key: null,
        error: "This photo has already been uploaded",
      },
      u3: { status: "uploaded", progress: 100, r2Key: "cats/u3/original", error: null },
    },
  },
};
