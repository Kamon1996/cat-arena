import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ColumnDef } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { CatCell } from "@/components/ui/cat-cell";
import { DataTable } from "@/components/ui/data-table";

type CatStatus = "ACTIVE" | "PENDING" | "BANNED";

type CatRow = {
  id: string;
  name: string;
  handle: string;
  owner: string;
  status: CatStatus;
  rating: number;
  votes: number;
  winRate: number;
  wins: number;
  losses: number;
  joined: string;
};

const STATUS_VARIANT: Record<CatStatus, "success" | "warning" | "destructive"> = {
  ACTIVE: "success",
  PENDING: "warning",
  BANNED: "destructive",
};

const columns: ColumnDef<CatRow, unknown>[] = [
  {
    accessorKey: "name",
    header: "Cat",
    cell: ({ row }) => <CatCell name={row.original.name} handle={row.original.handle} compact />,
  },
  { accessorKey: "owner", header: "Owner" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status]} dot>
        {row.original.status.toLowerCase()}
      </Badge>
    ),
  },
  {
    accessorKey: "rating",
    header: "Rating",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="font-display font-bold tabular-nums">{row.original.rating}</span>
    ),
  },
  {
    accessorKey: "votes",
    header: "Votes",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.votes}</span>,
  },
  {
    accessorKey: "winRate",
    header: "Win rate",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.winRate}%</span>,
  },
  {
    accessorKey: "wins",
    header: "Wins",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.wins}</span>,
  },
  {
    accessorKey: "losses",
    header: "Losses",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.losses}</span>,
  },
  { accessorKey: "joined", header: "Joined" },
];

const rows: CatRow[] = [
  {
    id: "1",
    name: "Mochi",
    handle: "@mochi",
    owner: "ava@cats.io",
    status: "ACTIVE",
    rating: 1820,
    votes: 312,
    winRate: 78,
    wins: 41,
    losses: 11,
    joined: "Jan 4, 2026",
  },
  {
    id: "2",
    name: "Tangerine",
    handle: "@tangerine",
    owner: "leo@cats.io",
    status: "ACTIVE",
    rating: 1760,
    votes: 288,
    winRate: 71,
    wins: 36,
    losses: 14,
    joined: "Jan 9, 2026",
  },
  {
    id: "3",
    name: "Pixel",
    handle: "@pixel",
    owner: "mia@cats.io",
    status: "PENDING",
    rating: 1690,
    votes: 255,
    winRate: 64,
    wins: 29,
    losses: 16,
    joined: "Feb 1, 2026",
  },
  {
    id: "4",
    name: "Biscuit",
    handle: "@biscuit",
    owner: "sam@cats.io",
    status: "ACTIVE",
    rating: 1605,
    votes: 201,
    winRate: 58,
    wins: 22,
    losses: 16,
    joined: "Feb 12, 2026",
  },
  {
    id: "5",
    name: "Noodle",
    handle: "@noodle",
    owner: "kai@cats.io",
    status: "BANNED",
    rating: 1540,
    votes: 180,
    winRate: 52,
    wins: 17,
    losses: 16,
    joined: "Feb 20, 2026",
  },
  {
    id: "6",
    name: "Pepper",
    handle: "@pepper",
    owner: "rin@cats.io",
    status: "ACTIVE",
    rating: 1498,
    votes: 164,
    winRate: 49,
    wins: 14,
    losses: 15,
    joined: "Mar 2, 2026",
  },
  {
    id: "7",
    name: "Waffles",
    handle: "@waffles",
    owner: "ivy@cats.io",
    status: "PENDING",
    rating: 1455,
    votes: 132,
    winRate: 45,
    wins: 11,
    losses: 14,
    joined: "Mar 10, 2026",
  },
  {
    id: "8",
    name: "Suki",
    handle: "@suki",
    owner: "ben@cats.io",
    status: "ACTIVE",
    rating: 1402,
    votes: 110,
    winRate: 41,
    wins: 9,
    losses: 13,
    joined: "Mar 18, 2026",
  },
  {
    id: "9",
    name: "Cleo",
    handle: "@cleo",
    owner: "zoe@cats.io",
    status: "ACTIVE",
    rating: 1366,
    votes: 98,
    winRate: 38,
    wins: 7,
    losses: 12,
    joined: "Mar 25, 2026",
  },
  {
    id: "10",
    name: "Bean",
    handle: "@bean",
    owner: "max@cats.io",
    status: "BANNED",
    rating: 1320,
    votes: 71,
    winRate: 33,
    wins: 5,
    losses: 11,
    joined: "Apr 1, 2026",
  },
];

const meta = {
  title: "UI/DataTable",
  component: DataTable<CatRow, unknown>,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: {
    columns,
    data: rows,
    pageIndex: 0,
    pageCount: 3,
    basePath: "/admin/cats",
    title: "Cats",
    count: 26,
  },
  // Width-capped so the wide table scrolls horizontally inside the soft card.
  render: (args) => (
    <div className="mx-auto max-w-2xl">
      <DataTable {...args} />
    </div>
  ),
} satisfies Meta<typeof DataTable<CatRow, unknown>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPagination: Story = {
  args: { pageIndex: 1, pageCount: 5 },
};

export const WithoutTitle: Story = {
  args: { title: undefined, count: undefined },
};

export const Empty: Story = {
  args: { data: [], count: 0 },
};
