import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { CatCardData, CatCardImage } from "@/components/dashboard/cat-card";
import { CatCard } from "@/components/dashboard/cat-card";

function photo(
  id: string,
  status: string,
  size: number,
  rejectionReasons: string[] = [],
): CatCardImage {
  return {
    id,
    status,
    rejectionReasons,
    width: size + 400,
    height: size + 400,
    thumbUrl: `https://placecats.com/${size}/${size}`,
    fullUrl: `https://placecats.com/${size + 400}/${size + 400}`,
  };
}

/* Happy path from the handoff: ranked ACTIVE cat, all prints approved. */
const baseCat: CatCardData = {
  id: "cat_1",
  name: "Molly",
  status: "ACTIVE",
  rank: 3,
  score: 1409,
  rating: 1734,
  rd: 140,
  wins: 5,
  losses: 1,
  timesShown: 6,
  images: [photo("a", "APPROVED", 300), photo("b", "APPROVED", 301), photo("c", "APPROVED", 302)],
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

export const Ranked: Story = {};

/* Mixed photo statuses: approved + in-review + rejected (stamp, Replace, tooltip). */
export const MixedPhotoStatuses: Story = {
  args: {
    cat: {
      ...baseCat,
      name: "Mochi",
      rank: 7,
      score: 1486,
      rating: 1642,
      rd: 40,
      wins: 218,
      losses: 96,
      timesShown: 410,
      images: [
        photo("a", "APPROVED", 303),
        photo("b", "PENDING", 304),
        photo("c", "REJECTED", 305, ["Too blurry to judge fairly. Pin up a sharper photo."]),
      ],
    },
  },
};

/* New cat: PENDING, unranked, one print + the empty Add-photo slot. */
export const NewCat: Story = {
  args: {
    cat: {
      ...baseCat,
      name: "Biscuit",
      status: "PENDING",
      rank: null,
      score: 1456,
      rating: 1500,
      rd: 350,
      wins: 0,
      losses: 0,
      timesShown: 0,
      images: [photo("a", "PENDING", 306)],
    },
  },
};

export const Banned: Story = {
  args: { cat: { ...baseCat, name: "Banned Bob", status: "BANNED", rank: null } },
};
