import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { AdminUserRow } from "@/components/admin/user-row-actions";
import { UsersTable } from "@/components/admin/users-table";

const rows: AdminUserRow[] = [
  {
    id: "user_1",
    name: "Whiskers Owner",
    email: "owner@example.com",
    role: "USER",
    banned: false,
    cats: 3,
    joined: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "user_2",
    name: "Mod Maven",
    email: "mod@example.com",
    role: "MODERATOR",
    banned: false,
    cats: 1,
    joined: "2026-02-02T00:00:00.000Z",
  },
  {
    id: "user_3",
    name: "Banned Bob",
    email: "banned@example.com",
    role: "USER",
    banned: true,
    cats: 0,
    joined: "2026-03-10T00:00:00.000Z",
  },
  {
    id: "user_4",
    name: "Admin Ada",
    email: "admin@example.com",
    role: "ADMIN",
    banned: false,
    cats: 7,
    joined: "2025-12-01T00:00:00.000Z",
  },
];

const meta = {
  title: "Admin/UsersTable",
  component: UsersTable,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  args: {
    rows,
    pageIndex: 0,
    pageCount: 1,
    currentUserId: "me",
  },
} satisfies Meta<typeof UsersTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { rows: [] },
};
