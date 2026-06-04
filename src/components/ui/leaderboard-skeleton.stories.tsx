import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { LeaderboardSkeleton } from "@/components/ui/leaderboard-skeleton";

const meta = {
  title: "UI/LeaderboardSkeleton",
  component: LeaderboardSkeleton,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    rows: 8,
  },
  render: (args) => (
    <div className="mx-auto max-w-3xl">
      <LeaderboardSkeleton {...args} />
    </div>
  ),
} satisfies Meta<typeof LeaderboardSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Default board placeholder (8 rows). */
export const Default: Story = {};

/** Compact placeholder — e.g. an organization board. */
export const Compact: Story = {
  args: { rows: 4 },
};
