import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const FIRST_RANK = 1;

export type OrgLeaderboardRow = {
  catId: string;
  name: string;
  slug: string;
  score: number;
  wins: number;
  losses: number;
};

type OrgLeaderboardProps = {
  rows: OrgLeaderboardRow[];
};

export function OrgLeaderboard({ rows }: OrgLeaderboardProps) {
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No cats yet in this organization.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Cat</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">W/L</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.catId}>
            <TableCell className="text-muted-foreground tabular-nums">
              {index + FIRST_RANK}
            </TableCell>
            <TableCell>
              <Link href={`/cat/${row.slug}`} className="font-medium hover:underline">
                {row.name}
              </Link>
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {Math.round(row.score)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {row.wins}/{row.losses}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
