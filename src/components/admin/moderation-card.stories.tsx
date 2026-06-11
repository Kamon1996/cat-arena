import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ModerationCard } from "@/components/admin/moderation-card";
import type { ModerationCat } from "@/moderation/moderation-types";

const mockCat: ModerationCat = {
  id: "cat_1",
  name: "Mittens the Magnificent",
  status: "PENDING",
  createdAt: "2026-06-04T12:00:00.000Z",
  owner: {
    id: "user_owner",
    name: "Jane Cat",
    email: "jane@example.com",
    role: "USER",
    banned: false,
  },
  images: [
    {
      id: "img_1",
      thumbUrl: "https://placecats.com/300/300",
      fullUrl: "https://placecats.com/600/600",
    },
    {
      id: "img_2",
      thumbUrl: "https://placecats.com/301/301",
      fullUrl: "https://placecats.com/602/602",
    },
  ],
};

const meta = {
  title: "Admin/ModerationCard",
  component: ModerationCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    cat: mockCat,
    isAdmin: true,
    currentUserId: "me",
    onResolved: fn(),
    onOwnerResolved: fn(),
  },
} satisfies Meta<typeof ModerationCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AsModerator: Story = { args: { isAdmin: false } };
