import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/ui/data-table";

type Row = {
  id: string;
  name: string;
  role: string;
};

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "role", header: "Role" },
];

const rows: Row[] = [
  { id: "u_1", name: "Mittens", role: "OWNER" },
  { id: "u_2", name: "Sir Fluff", role: "ADMIN" },
  { id: "u_3", name: "Whiskers", role: "USER" },
];

const meta = {
  title: "UI/DataTable",
  component: DataTable<Row, unknown>,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  args: {
    columns,
    data: rows,
    pageIndex: 0,
    pageCount: 1,
    basePath: "/admin/users",
  },
} satisfies Meta<typeof DataTable<Row, unknown>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithPagination: Story = {
  args: {
    pageIndex: 1,
    pageCount: 5,
  },
};

export const Empty: Story = {
  args: {
    data: [],
  },
};
