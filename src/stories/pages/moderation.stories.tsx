import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModerationList } from "@/components/admin/moderation-list";
import type { ModerationPage } from "@/moderation/moderation-types";

const initial: ModerationPage = {
  cats: [
    {
      id: "cat_1",
      name: "Mittens the Magnificent",
      status: "PENDING",
      createdAt: "2026-06-04T12:00:00.000Z",
      owner: {
        id: "user_1",
        name: "Ada Lovelace",
        email: "ada@example.com",
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
    },
    {
      id: "cat_2",
      name: "Sir Fluff",
      status: "PENDING",
      createdAt: "2026-06-04T12:00:00.000Z",
      owner: {
        id: "user_2",
        name: null,
        email: "grace@example.com",
        role: "MODERATOR",
        banned: false,
      },
      images: [
        {
          id: "img_3",
          thumbUrl: "https://placecats.com/302/302",
          fullUrl: "https://placecats.com/604/604",
        },
      ],
    },
  ],
  nextCursor: null,
};

const meta = {
  title: "Pages/Moderation",
  component: ModerationList,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ModerationList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { initial, isAdmin: true, currentUserId: "me" },
};

export const Moderator: Story = {
  args: { initial, isAdmin: false, currentUserId: "me" },
};

export const Empty: Story = {
  args: {
    initial: { cats: [], nextCursor: null },
    isAdmin: true,
    currentUserId: "me",
  },
};
