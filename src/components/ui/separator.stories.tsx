import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Separator } from "@/components/ui/separator";

const meta = {
  title: "UI/Separator",
  component: Separator,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    orientation: "horizontal",
    decorative: true,
  },
  argTypes: {
    orientation: {
      control: "select",
      options: ["horizontal", "vertical"],
    },
    decorative: { control: "boolean" },
  },
  render: (args) => (
    <div className="w-72">
      <p className="text-sm font-medium">Leaderboard</p>
      <Separator {...args} className="my-3" />
      <p className="text-sm text-muted-foreground">Sorted by conservative score.</p>
    </div>
  ),
} satisfies Meta<typeof Separator>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Horizontal: Story = {
  render: () => (
    <div className="w-72">
      <p className="text-sm font-medium">Leaderboard</p>
      <Separator className="my-3" />
      <p className="text-sm text-muted-foreground">Sorted by conservative score.</p>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-8 items-center gap-3 text-sm">
      <span>Duels</span>
      <Separator orientation="vertical" />
      <span>Leaderboard</span>
      <Separator orientation="vertical" />
      <span>Upload</span>
    </div>
  ),
};
