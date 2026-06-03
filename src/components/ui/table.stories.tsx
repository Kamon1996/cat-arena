import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type LeaderboardRow = {
  rank: number;
  name: string;
  score: number;
  votes: number;
};

const rows: LeaderboardRow[] = [
  { rank: 1, name: "Mittens the Magnificent", score: 1842, votes: 312 },
  { rank: 2, name: "Sir Fluff", score: 1790, votes: 280 },
  { rank: 3, name: "Captain Whiskers", score: 1655, votes: 198 },
  { rank: 4, name: "Lady Paws", score: 1521, votes: 154 },
];

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  args: {
    className: "w-[480px]",
  },
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table className="w-[480px]">
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Cat</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Votes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.rank}>
            <TableCell className="font-medium">{row.rank}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right">{row.score}</TableCell>
            <TableCell className="text-right">{row.votes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithCaption: Story = {
  render: () => (
    <Table className="w-[480px]">
      <TableCaption>Top cats by conservative Glicko-2 score.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Cat</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.rank}>
            <TableCell className="font-medium">{row.rank}</TableCell>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right">{row.score}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Table className="w-[480px]">
      <TableHeader>
        <TableRow>
          <TableHead>Cat</TableHead>
          <TableHead className="text-right">Votes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.rank}>
            <TableCell>{row.name}</TableCell>
            <TableCell className="text-right">{row.votes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell className="text-right">
            {rows.reduce((sum, row) => sum + row.votes, 0)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table className="w-[480px]">
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Cat</TableHead>
          <TableHead className="text-right">Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
            No cats yet.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
