import type { Metadata } from "next";

import { JsonLd } from "@/components/seo/json-ld";
import { Leaderboard } from "@/components/ui/leaderboard";
import { getLeaderboard } from "@/data/leaderboard";
import { SITE_NAME } from "@/lib/constants";
import { leaderboardJsonLd } from "@/lib/seo";
import { absoluteUrl, catPath } from "@/lib/site";

// ISR: 1h. Next requires a static literal here (= ISR_REVALIDATE_SECONDS).
export const revalidate = 3600;

const TOP_DESCRIPTION = "The best cats ranked by Glicko-2 rating (conservative lower-bound score).";

export const metadata: Metadata = {
  title: "Top Cats",
  description: TOP_DESCRIPTION,
  alternates: { canonical: absoluteUrl("/top") },
  openGraph: {
    title: `Top Cats | ${SITE_NAME}`,
    description: TOP_DESCRIPTION,
    url: absoluteUrl("/top"),
    type: "website",
  },
  twitter: { card: "summary_large_image", title: `Top Cats | ${SITE_NAME}` },
};

export default async function TopPage() {
  const rows = await getLeaderboard();

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <JsonLd data={leaderboardJsonLd(rows.map((row) => ({ name: row.name, slug: row.slug })))} />
      <h1 className="mb-6 font-display font-bold text-3xl">Top Cats</h1>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No cats yet — be the first to add one!</p>
      ) : (
        <Leaderboard
          label="Top cats by score"
          statHeaders={["Score", "W/L"]}
          entries={rows.map((row) => ({
            id: row.id,
            rank: row.rank,
            name: row.name,
            href: catPath(row.slug),
            stats: [Math.round(row.score), `${row.wins}/${row.losses}`],
          }))}
        />
      )}
    </main>
  );
}
