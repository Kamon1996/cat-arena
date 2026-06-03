import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { UploadForm } from "@/components/upload/upload-form";

const meta = {
  title: "Upload/UploadForm",
  component: UploadForm,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {},
} satisfies Meta<typeof UploadForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <UploadForm />
    </div>
  ),
};
