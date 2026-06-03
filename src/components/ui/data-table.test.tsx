import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable } from "./data-table";

type Row = { id: string; name: string };
const columns: ColumnDef<Row>[] = [{ accessorKey: "name", header: "Name" }];

describe("DataTable", () => {
  it("renders header and rows", () => {
    render(
      <DataTable
        columns={columns}
        data={[{ id: "1", name: "Mittens" }]}
        pageIndex={0}
        pageCount={1}
        basePath="/x"
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Mittens")).toBeInTheDocument();
  });

  it("renders an empty state with no rows", () => {
    render(<DataTable columns={columns} data={[]} pageIndex={0} pageCount={1} basePath="/x" />);
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
