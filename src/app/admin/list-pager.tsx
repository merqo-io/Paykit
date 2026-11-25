import Link from "next/link";
import { listHref } from "./list-params";

/** Real anchors so paging works without JS and can be opened in a new tab; filters stay in each href. */
export function ListPager({
  path,
  params,
  page,
  pageCount,
}: {
  path: string;
  params: Record<string, string>;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  const href = (next: number) => listHref(path, { ...params, page: next });
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 text-sm"
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link
          href={href(page + 1)}
          rel="next"
          className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
