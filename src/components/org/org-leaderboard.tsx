import { Leaderboard, type LeaderboardEntry } from "@/components/ui/leaderboard";

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
    return <p className="text-muted-foreground text-sm">No cats yet in this organization.</p>;
  }

  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    id: row.catId,
    rank: index + FIRST_RANK,
    name: row.name,
    href: `/cat/${row.slug}`,
    stats: [
      <span key="score" className="font-display font-bold text-lg tabular-nums">
        {Math.round(row.score)}
      </span>,
      <span key="wl" className="text-muted-foreground tabular-nums">
        {row.wins}/{row.losses}
      </span>,
    ],
  }));

  return (
    <Leaderboard
      label="Organization leaderboard"
      statHeaders={["Score", "W/L"]}
      entries={entries}
    />
  );
}
