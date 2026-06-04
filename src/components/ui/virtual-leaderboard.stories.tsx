import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import type { LeaderboardEntry } from "@/components/ui/leaderboard";
import { VirtualLeaderboard } from "@/components/ui/virtual-leaderboard";

const FIRST_RANK = 1;
const TOTAL_CATS = 100;
const BASE_RATING = 1850;
const RATING_STEP = 3;

const ratingCell = (value: number) => (
  <span className="font-display font-bold text-lg tabular-nums">{value}</span>
);
const recordCell = (wins: number, losses: number) => (
  <span className="text-muted-foreground tabular-nums">
    {wins}/{losses}
  </span>
);

// A full 100-cat board — the case the window virtualizer exists for.
const entries: LeaderboardEntry[] = Array.from({ length: TOTAL_CATS }, (_, i) => ({
  id: `cat-${i + 1}`,
  rank: i + FIRST_RANK,
  name: `Cat ${i + 1}`,
  handle: `@cat${i + 1}`,
  href: "#",
  stats: [ratingCell(BASE_RATING - i * RATING_STEP), recordCell(TOTAL_CATS - i, i)],
}));

const meta = {
  title: "UI/VirtualLeaderboard",
  component: VirtualLeaderboard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    label: "Top cats by score",
    statHeaders: ["Score", "W/L"],
    entries,
  },
  render: (args) => (
    <div className="mx-auto max-w-3xl">
      <VirtualLeaderboard {...args} />
    </div>
  ),
} satisfies Meta<typeof VirtualLeaderboard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The full 100-cat board — scroll the window to see rows mount/unmount. */
export const FullBoard: Story = {};

/** A short board (no virtualization benefit, but renders identically). */
export const ShortBoard: Story = {
  args: {
    entries: entries.slice(0, 5),
  },
};
