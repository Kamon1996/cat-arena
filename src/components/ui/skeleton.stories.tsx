import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Skeleton } from "@/components/ui/skeleton";

const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    className: "h-4 w-48",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Circle: Story = {
  args: { className: "size-12 rounded-full" },
};

export const CardPlaceholder: Story = {
  render: () => (
    <div className="flex w-72 items-center gap-4">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  ),
};

export const DuelPlaceholder: Story = {
  render: () => (
    <div className="flex gap-4">
      <Skeleton className="size-40 rounded-xl" />
      <Skeleton className="size-40 rounded-xl" />
    </div>
  ),
};
