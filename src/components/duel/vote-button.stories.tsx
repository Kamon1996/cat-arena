import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";

import { VoteButton } from "@/components/duel/vote-button";

const meta = {
  title: "Duel/VoteButton",
  component: VoteButton,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: { label: "Pick Mittens", onVote: fn(), disabled: false },
} satisfies Meta<typeof VoteButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: { disabled: true },
};
