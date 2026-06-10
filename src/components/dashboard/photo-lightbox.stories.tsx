import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { PhotoLightbox } from "@/components/dashboard/photo-lightbox";

const meta = {
  title: "Dashboard/PhotoLightbox",
  component: PhotoLightbox,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    catName: "Molly",
    photos: [
      {
        url: "https://placecats.com/700/700",
        thumbUrl: "https://placecats.com/300/300",
        width: 700,
        height: 700,
        status: "APPROVED",
      },
      {
        url: "https://placecats.com/800/500",
        thumbUrl: "https://placecats.com/320/200",
        width: 800,
        height: 500,
        status: "PENDING",
      },
      {
        url: "https://placecats.com/500/800",
        thumbUrl: "https://placecats.com/200/320",
        width: 500,
        height: 800,
        status: "REJECTED",
      },
    ],
    openIndex: 0,
    onClose: fn(),
  },
} satisfies Meta<typeof PhotoLightbox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Carousel: Story = {};

export const SinglePhoto: Story = {
  args: {
    photos: [
      {
        url: "https://placecats.com/700/700",
        thumbUrl: "https://placecats.com/300/300",
        width: 700,
        height: 700,
        status: "APPROVED",
      },
    ],
  },
};
