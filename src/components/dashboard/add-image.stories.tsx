import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { AddImage } from "@/components/dashboard/add-image";

const meta = {
  title: "Dashboard/AddImage",
  component: AddImage,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    catId: "cat_1",
    remaining: 3,
    disabled: false,
  },
} satisfies Meta<typeof AddImage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const RemainingSlots: Story = {
  args: { catId: "cat_1", remaining: 3 },
};

export const Full: Story = {
  args: { catId: "cat_2", remaining: 0 },
};

export const Disabled: Story = {
  args: { catId: "cat_3", remaining: 3, disabled: true },
};
