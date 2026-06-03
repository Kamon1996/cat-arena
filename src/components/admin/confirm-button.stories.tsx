import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { ConfirmButton } from "@/components/admin/confirm-button";

const meta = {
  title: "Admin/ConfirmButton",
  component: ConfirmButton,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: {
      control: "select",
      options: ["default", "xs", "sm", "lg", "icon", "icon-xs", "icon-sm", "icon-lg"],
    },
  },
  args: {
    label: "Ban user",
    title: "Ban this user?",
    description: "Their cats will be deleted. This cannot be undone.",
    confirmLabel: "Ban",
    variant: "destructive",
    size: "default",
    disabled: false,
    onConfirm: fn(),
  },
} satisfies Meta<typeof ConfirmButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    label: "Ban",
    title: "Ban this user?",
    description: "Their cats will be deleted. This cannot be undone.",
    confirmLabel: "Ban user",
    variant: "destructive",
    size: "sm",
  },
};

export const Disabled: Story = {
  args: {
    label: "Ban",
    title: "Ban this user?",
    description: "Their cats will be deleted. This cannot be undone.",
    confirmLabel: "Ban user",
    variant: "destructive",
    size: "sm",
    disabled: true,
  },
};
