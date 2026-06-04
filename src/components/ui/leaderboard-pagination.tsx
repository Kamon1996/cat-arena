import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const FIRST_PAGE = 1;

interface LeaderboardPaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total number of pages (≥ 1). */
  pageCount: number;
  /** Base path for page links (e.g. "/top"). Page 1 stays clean for the canonical. */
  basePath: string;
}

/** Page 1 → clean base path (matches the canonical); deeper pages → `?page=N`. */
function pageHref(basePath: string, page: number): string {
  return page <= FIRST_PAGE ? basePath : `${basePath}?page=${page}`;
}

/** Prev / Next leaderboard navigation with a page indicator. Render only when pageCount > 1. */
export function LeaderboardPagination({ page, pageCount, basePath }: LeaderboardPaginationProps) {
  const hasPrev = page > FIRST_PAGE;
  const hasNext = page < pageCount;

  return (
    <nav
      aria-label="Leaderboard pages"
      className="mt-6 flex items-center justify-center gap-3 sm:gap-4"
    >
      {hasPrev ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(basePath, page - 1)} rel="prev">
            <ChevronLeft className="size-4" aria-hidden="true" />
            Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <ChevronLeft className="size-4" aria-hidden="true" />
          Previous
        </Button>
      )}

      <span className="text-muted-foreground text-sm tabular-nums">
        Page {page} of {pageCount}
      </span>

      {hasNext ? (
        <Button asChild variant="outline" size="sm">
          <Link href={pageHref(basePath, page + 1)} rel="next">
            Next
            <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Next
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      )}
    </nav>
  );
}
