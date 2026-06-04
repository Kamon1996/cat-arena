import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CatCell } from "@/components/ui/cat-cell";

const meta = {
  title: "UI/CatCell",
  component: CatCell,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    name: "Mochi",
    compact: false,
  },
  argTypes: {
    compact: { control: "boolean" },
  },
} satisfies Meta<typeof CatCell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithHandle: Story = {
  args: { handle: "@mochi" },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CustomColor: Story = {
  args: { name: "Tangerine", color: "var(--secondary)", fg: "var(--secondary-foreground)" },
};

/** The avatar colour is deterministic per name — same cat, same colour. */
export const Palette: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {["Mochi", "Tangerine", "Pixel", "Biscuit", "Noodle"].map((name) => (
        <CatCell key={name} name={name} handle={`@${name.toLowerCase()}`} />
      ))}
    </div>
  ),
};
