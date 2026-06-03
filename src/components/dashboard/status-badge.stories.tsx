import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { StatusBadge } from "@/components/dashboard/status-badge";

const meta = {
  title: "Dashboard/StatusBadge",
  component: StatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: ["ACTIVE", "PENDING", "HIDDEN", "BANNED", "APPROVED", "REJECTED"],
    },
  },
  args: {
    status: "ACTIVE",
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Active: Story = { args: { status: "ACTIVE" } };
export const Pending: Story = { args: { status: "PENDING" } };
export const Hidden: Story = { args: { status: "HIDDEN" } };
export const Banned: Story = { args: { status: "BANNED" } };
export const Approved: Story = { args: { status: "APPROVED" } };
export const Rejected: Story = { args: { status: "REJECTED" } };
