import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ToggleChip } from "@/components/ui/toggle-chip";

const meta = {
  title: "UI/ToggleChip",
  component: ToggleChip,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    children: "Blurry / low-res",
    pressed: false,
    onClick: fn(),
  },
  argTypes: {
    pressed: { control: "boolean" },
  },
} satisfies Meta<typeof ToggleChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: { pressed: true },
};

export const Row: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2.5">
      <ToggleChip pressed={false}>Not a cat</ToggleChip>
      <ToggleChip pressed>Blurry / low-res</ToggleChip>
      <ToggleChip pressed={false}>Inappropriate</ToggleChip>
      <ToggleChip pressed>Duplicate</ToggleChip>
    </div>
  ),
};
