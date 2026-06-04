"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowData,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // Optional per-column alignment, applied to both the header and the cells.
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right";
  }
}

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageIndex: number; // 0-based
  pageCount: number;
  basePath: string;
  /** Optional title bar (the soft "grouped card" look used in admin). */
  title?: string | undefined;
  /** Total entry count shown in the title-bar badge (defaults to current rows). */
  count?: number | undefined;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  pageIndex,
  pageCount,
  basePath,
  title,
  count,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
  });
  const page = pageIndex + 1;
  const totalPages = Math.max(pageCount, 1);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {title ? (
          <div className="flex items-center justify-between border-border border-b px-5 py-4">
            <span className="font-display font-semibold text-lg">{title}</span>
            <Badge variant="outline">{count ?? data.length} entries</Badge>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "h-auto bg-[color-mix(in_oklab,var(--muted)_45%,var(--card))] px-5 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider",
                      header.column.columnDef.meta?.align === "right" && "text-right",
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-5 py-2.5 text-sm",
                        cell.column.columnDef.meta?.align === "right" && "text-right",
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 px-5 text-center text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page <= 1 ? (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}?page=${page - 1}`}>Previous</Link>
            </Button>
          )}
          {page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}?page=${page + 1}`}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
