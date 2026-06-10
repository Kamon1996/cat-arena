import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { PolaroidPrint } from "@/components/dashboard/polaroid-print";

const meta = {
  title: "Dashboard/PolaroidPrint",
  component: PolaroidPrint,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    photo: {
      id: "img_1",
      thumbUrl: "https://placecats.com/300/300",
      fullUrl: "https://placecats.com/700/700",
      width: 700,
      height: 700,
      status: "APPROVED",
      rejectionReasons: [],
    },
    index: 0,
    busy: false,
    readOnly: false,
    onOpen: fn(),
    onRemove: fn(),
    onReplace: fn(),
  },
  // Breathing room so the tilt/hover-lift and the pin are not clipped.
  render: (args) => (
    <div className="p-10">
      <PolaroidPrint {...args} />
    </div>
  ),
} satisfies Meta<typeof PolaroidPrint>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Approved: Story = {};

export const InReview: Story = {
  args: {
    index: 1,
    photo: {
      id: "img_2",
      thumbUrl: "https://placecats.com/301/301",
      fullUrl: "https://placecats.com/701/701",
      width: 700,
      height: 700,
      status: "PENDING",
      rejectionReasons: [],
    },
  },
};

export const Rejected: Story = {
  args: {
    index: 2,
    photo: {
      id: "img_3",
      thumbUrl: "https://placecats.com/302/302",
      fullUrl: "https://placecats.com/702/702",
      width: 700,
      height: 700,
      status: "REJECTED",
      rejectionReasons: ["Too blurry to judge fairly. Pin up a sharper photo."],
    },
  },
};
