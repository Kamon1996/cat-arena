import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { type AdminUserRow, UserRowActions } from "@/components/admin/user-row-actions";

const baseUser: AdminUserRow = {
  id: "user_1",
  name: "Whiskers Owner",
  email: "owner@example.com",
  role: "USER",
  banned: false,
  cats: 3,
  joined: "2026-01-15T00:00:00.000Z",
};

const meta = {
  title: "Admin/UserRowActions",
  component: UserRowActions,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    user: baseUser,
    currentUserId: "me",
  },
  decorators: [
    (Story) => (
      <div className="flex w-96 items-center justify-end">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UserRowActions>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const BannedUser: Story = {
  args: {
    user: { ...baseUser, id: "user_2", email: "banned@example.com", banned: true },
  },
};

export const AdminRow: Story = {
  args: {
    user: { ...baseUser, id: "user_3", email: "admin@example.com", role: "ADMIN" },
  },
};

export const SelfRow: Story = {
  args: {
    user: { ...baseUser, id: "me", email: "me@example.com" },
  },
};
