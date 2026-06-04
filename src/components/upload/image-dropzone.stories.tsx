import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { fn } from "storybook/test";

import { ImageDropzone } from "@/components/upload/image-dropzone";

const meta = {
  title: "Upload/ImageDropzone",
  component: ImageDropzone,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { files: [], onChange: fn(), disabled: false },
  render: (args) => {
    const [files, setFiles] = useState<File[]>(args.files);
    return (
      <div className="w-96">
        <ImageDropzone
          files={files}
          onChange={(next) => {
            args.onChange(next);
            setFiles(next);
          }}
          disabled={args.disabled ?? false}
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
