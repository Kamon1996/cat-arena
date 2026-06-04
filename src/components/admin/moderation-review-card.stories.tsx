import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ModerationReviewCard } from "@/components/admin/moderation-review-card";

const meta = {
  title: "Admin/ModerationReviewCard",
  component: ModerationReviewCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    catName: "Mochi",
    submittedBy: "Aiko Tanaka · @mochi.meow · 2 min ago",
    images: [
      { filename: "IMG_2042", dimensions: "1080×1350" },
      { filename: "IMG_2043", dimensions: "1080×1350" },
      { filename: "IMG_2044", dimensions: "1080×1350" },
    ],
    queuePosition: 12,
    queueTotal: 248,
    onApprove: fn(),
    onReject: fn(),
    onBack: fn(),
    onZoom: fn(),
  },
  // Phone frame, just for the draft preview — the card itself fills its container.
  render: (args) => (
    <div className="h-[760px] w-[390px] max-w-full overflow-hidden rounded-2xl border-2 border-ink shadow-sticker">
      <ModerationReviewCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ModerationReviewCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPhoto: Story = {
  args: {
    images: [
      { url: "https://placecats.com/400/500", filename: "IMG_2042", dimensions: "1080×1350" },
    ],
  },
};

export const SinglePhoto: Story = {
  args: {
    images: [{ filename: "IMG_2042", dimensions: "1080×1350" }],
  },
};
