import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { Badge } from "@/components/ui/badge";
import { Leaderboard, type LeaderboardEntry } from "@/components/ui/leaderboard";

const ratingCell = (value: number) => (
  <span className="font-display font-bold text-lg tabular-nums">{value}</span>
);
const winRateCell = (value: number) => (
  <Badge variant={value >= 70 ? "success" : "warning"} dot>
    {value}%
  </Badge>
);
const plainCell = (value: string | number) => <span className="tabular-nums">{value}</span>;

const cats = [
  { id: "1", name: "Mochi", handle: "@mochi", rating: 1820, winRate: 78, votes: 312, w: 41, l: 11 },
  {
    id: "2",
    name: "Tangerine",
    handle: "@tangerine",
    rating: 1760,
    winRate: 71,
    votes: 288,
    w: 36,
    l: 14,
  },
  { id: "3", name: "Pixel", handle: "@pixel", rating: 1690, winRate: 64, votes: 255, w: 29, l: 16 },
  {
    id: "4",
    name: "Biscuit",
    handle: "@biscuit",
    rating: 1605,
    winRate: 58,
    votes: 201,
    w: 22,
    l: 16,
  },
  {
    id: "5",
    name: "Noodle",
    handle: "@noodle",
    rating: 1540,
    winRate: 52,
    votes: 180,
    w: 17,
    l: 16,
  },
];

const entries: LeaderboardEntry[] = cats.map((c, i) => ({
  id: c.id,
  rank: i + 1,
  name: c.name,
  handle: c.handle,
  href: "#",
  stats: [ratingCell(c.rating), winRateCell(c.winRate), plainCell(c.votes)],
}));

const meta = {
  title: "UI/Leaderboard",
  component: Leaderboard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    label: "Top cats",
    statHeaders: ["Rating", "Win rate", "Votes"],
    entries,
  },
  render: (args) => (
    <div className="mx-auto max-w-3xl">
      <Leaderboard {...args} />
    </div>
  ),
} satisfies Meta<typeof Leaderboard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Same component, different stat columns — Score + W/L (as the org leaderboard uses it). */
export const ScoreAndRecord: Story = {
  args: {
    label: "Organization leaderboard",
    statHeaders: ["Score", "W/L"],
    entries: cats.map((c, i) => ({
      id: c.id,
      rank: i + 1,
      name: c.name,
      href: "#",
      stats: [ratingCell(c.rating), plainCell(`${c.w}/${c.l}`)],
    })),
  },
};
