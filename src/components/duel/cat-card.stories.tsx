import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { CatCard } from "@/components/duel/cat-card";
import type { PairCat } from "@/lib/api-types";

const mockCat: PairCat = {
  id: "cat_1",
  name: "Mittens the Magnificent",
  slug: "mittens-the-magnificent",
  images: [
    { url: "https://placecats.com/300/300", width: 300, height: 300, position: 0 },
    { url: "https://placecats.com/301/301", width: 301, height: 301, position: 1 },
  ],
};

const meta = {
  title: "Duel/CatCard",
  component: CatCard,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { cat: mockCat, onPick: fn(), disabled: false },
} satisfies Meta<typeof CatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
