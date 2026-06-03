import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { RenameCatForm } from "@/components/dashboard/rename-cat-form";

const meta = {
  title: "Dashboard/RenameCatForm",
  component: RenameCatForm,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    catId: "cat_1",
    currentName: "Mittens",
    disabled: false,
  },
} satisfies Meta<typeof RenameCatForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { catId: "cat_2", currentName: "Banned Bob", disabled: true },
};
