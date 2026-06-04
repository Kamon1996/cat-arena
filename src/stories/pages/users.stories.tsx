import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { AdminUserRow } from "@/components/admin/user-row-actions";
import { UsersTable } from "@/components/admin/users-table";

const rows: AdminUserRow[] = [
  {
    id: "me",
    name: "You (Admin)",
    email: "admin@example.com",
    role: "ADMIN",
    banned: false,
    cats: 5,
    joined: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "user_2",
    name: "Ada Lovelace",
    email: "ada@example.com",
    role: "USER",
    banned: false,
    cats: 3,
    joined: "2026-02-14T00:00:00.000Z",
  },
  {
    id: "user_3",
    name: null,
    email: "grace@example.com",
    role: "MODERATOR",
    banned: false,
    cats: 0,
    joined: "2026-03-21T00:00:00.000Z",
  },
  {
    id: "user_4",
    name: "Banned Bob",
    email: "bob@example.com",
    role: "USER",
    banned: true,
    cats: 1,
    joined: "2026-04-05T00:00:00.000Z",
  },
];

const meta = {
  title: "Pages/Users",
  component: UsersTable,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof UsersTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { rows, pageIndex: 0, pageCount: 1, currentUserId: "me" },
};

export const Empty: Story = {
  args: { rows: [], pageIndex: 0, pageCount: 1, currentUserId: "me" },
};
