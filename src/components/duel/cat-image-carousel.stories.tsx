import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CatImageCarousel } from "@/components/duel/cat-image-carousel";
import type { PairImage } from "@/lib/api-types";

const singleImage: PairImage[] = [
  { url: "https://placecats.com/300/300", width: 300, height: 300, position: 0 },
];

const multipleImages: PairImage[] = [
  { url: "https://placecats.com/300/300", width: 300, height: 300, position: 0 },
  { url: "https://placecats.com/301/301", width: 301, height: 301, position: 1 },
  { url: "https://placecats.com/302/302", width: 302, height: 302, position: 2 },
];

const meta = {
  title: "Duel/CatImageCarousel",
  component: CatImageCarousel,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { name: "Whiskers", images: multipleImages, className: "aspect-square w-72" },
} satisfies Meta<typeof CatImageCarousel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleImage: Story = {
  args: { name: "Sir Whiskers", images: singleImage },
};

export const MultipleImages: Story = {
  args: { name: "Lady Pawline", images: multipleImages },
};
