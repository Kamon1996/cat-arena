import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { ModerationList } from "@/components/admin/moderation-list";
import type { ModerationPage } from "@/moderation/moderation-types";

const withCats: ModerationPage = {
  cats: [
    {
      id: "cat_1",
      name: "Mittens the Magnificent",
      status: "PENDING",
      owner: {
        id: "user_1",
        name: "Jane Cat",
        email: "jane@example.com",
        role: "USER",
        banned: false,
      },
      images: [
        { id: "img_1", thumbUrl: "https://placecats.com/300/300" },
        { id: "img_2", thumbUrl: "https://placecats.com/301/301" },
      ],
    },
    {
      id: "cat_2",
      name: "Sir Fluff",
      status: "PENDING",
      owner: {
        id: "user_2",
        name: "Bob Whiskers",
        email: "bob@example.com",
        role: "USER",
        banned: false,
      },
      images: [{ id: "img_3", thumbUrl: "https://placecats.com/302/302" }],
    },
  ],
  nextCursor: null,
};

const empty: ModerationPage = { cats: [], nextCursor: null };

const meta = {
  title: "Admin/ModerationList",
  component: ModerationList,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    initial: withCats,
    isAdmin: true,
    currentUserId: "me",
  },
} satisfies Meta<typeof ModerationList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { initial: empty } };
