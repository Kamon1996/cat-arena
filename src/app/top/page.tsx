import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { JsonLd } from "@/components/seo/json-ld";
import { LeaderboardPagination } from "@/components/ui/leaderboard-pagination";
import { VirtualLeaderboard } from "@/components/ui/virtual-leaderboard";
import { getCachedLeaderboard } from "@/data/leaderboard";
import { ROUTES, SITE_NAME } from "@/lib/constants";
import { leaderboardJsonLd } from "@/lib/seo";
import { absoluteUrl, catPath } from "@/lib/site";

const FIRST_PAGE = 1;
const TOP_DESCRIPTION = "The best cats ranked by Glicko-2 rating (conservative lower-bound score).";

// `?page` is untrusted input — validate at the boundary. Anything non-positive or
// non-integer (or absent) collapses to page 1.
const pageParamSchema = z.coerce.number().int().positive().catch(FIRST_PAGE);

function parsePage(raw: string | undefined): number {
  return pageParamSchema.parse(raw);
}

/** Page 1 keeps the clean canonical (/top); deeper pages self-canonicalize to ?page=N. */
function topCanonical(page: number): string {
  return page <= FIRST_PAGE ? absoluteUrl(ROUTES.TOP) : absoluteUrl(`${ROUTES.TOP}?page=${page}`);
}

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { page: raw } = await searchParams;
  const page = parsePage(raw);
  const canonical = topCanonical(page);
  const title = page > FIRST_PAGE ? `Top Cats — Page ${page}` : "Top Cats";

  return {
    title,
    description: TOP_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description: TOP_DESCRIPTION,
      url: canonical,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${SITE_NAME}`,
      description: TOP_DESCRIPTION,
    },
  };
}

export default async function TopPage({ searchParams }: PageProps) {
  const { page: raw } = await searchParams;
  const requestedPage = parsePage(raw);
  const { rows, page, pageCount, total } = await getCachedLeaderboard(requestedPage);

  // A page beyond the data is a 404 (avoids thin, crawlable duplicates of an empty board).
  if (total > 0 && requestedPage > pageCount) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <JsonLd data={leaderboardJsonLd(rows.map((row) => ({ name: row.name, slug: row.slug })))} />
      <h1 className="mb-6 font-display font-bold text-3xl">Top Cats</h1>
      {total === 0 ? (
        <p className="text-muted-foreground">No cats yet — be the first to add one!</p>
      ) : (
        <>
          <VirtualLeaderboard
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
          {pageCount > FIRST_PAGE ? (
            <LeaderboardPagination page={page} pageCount={pageCount} basePath={ROUTES.TOP} />
          ) : null}
        </>
      )}
    </main>
  );
}
