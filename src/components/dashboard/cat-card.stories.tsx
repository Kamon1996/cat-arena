import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CatCardData } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";

const baseCat: CatCardData = {
  id: "cat_1",
  name: "Mittens the Magnificent",
  status: "ACTIVE",
  rank: 7,
  score: 1486,
  rating: 1642,
  rd: 22,
  wins: 218,
  losses: 96,
  timesShown: 410,
  images: [
    { id: "a", status: "APPROVED", thumbUrl: "https://placecats.com/300/300" },
    { id: "b", status: "PENDING", thumbUrl: "https://placecats.com/301/301" },
  ],
};

const meta = {
  title: "Dashboard/CatCard",
  component: CatCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    cat: baseCat,
  },
} satisfies Meta<typeof CatCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Active: Story = {};

export const Settling: Story = {
  args: {
    cat: {
      ...baseCat,
      name: "Sir Fluff",
      status: "PENDING",
      rank: null,
      score: 1456,
      rating: 1500,
      rd: 140,
      wins: 3,
      losses: 1,
      timesShown: 8,
      images: [{ id: "c", status: "PENDING", thumbUrl: "https://placecats.com/302/302" }],
    },
  },
};

export const Banned: Story = {
  args: { cat: { ...baseCat, name: "Banned Bob", status: "BANNED" } },
};
