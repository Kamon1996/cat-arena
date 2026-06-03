"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { type AdminUserRow, UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

function buildColumns(currentUserId: string): ColumnDef<AdminUserRow>[] {
  return [
    {
      accessorKey: "email",
      header: "User",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.original.email ?? "—"}</span>
          {row.original.name ? (
            <span className="text-muted-foreground text-xs">{row.original.name}</span>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => <Badge variant="secondary">{row.original.role}</Badge>,
    },
    { accessorKey: "cats", header: "Cats" },
    {
      accessorKey: "banned",
      header: "Status",
      cell: ({ row }) =>
        row.original.banned ? (
          <Badge variant="destructive">banned</Badge>
        ) : (
          <Badge variant="outline">active</Badge>
        ),
    },
    {
      accessorKey: "joined",
      header: "Joined",
      cell: ({ row }) => new Date(row.original.joined).toLocaleDateString(),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => <UserRowActions user={row.original} currentUserId={currentUserId} />,
    },
  ];
}

export function UsersTable({
  rows,
  pageIndex,
  pageCount,
  currentUserId,
}: {
  rows: AdminUserRow[];
  pageIndex: number;
  pageCount: number;
  currentUserId: string;
}) {
  return (
    <DataTable
      columns={buildColumns(currentUserId)}
      data={rows}
      pageIndex={pageIndex}
      pageCount={pageCount}
      basePath="/admin/users"
    />
  );
}
