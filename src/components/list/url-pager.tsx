import Link from "next/link";

const LINK_CLASS =
  "inline-flex min-h-11 items-center underline underline-offset-4";
const DISABLED_CLASS =
  "inline-flex min-h-11 items-center text-muted-foreground";

/** Real anchors so paging works without JS and can be opened in a new tab; the caller's href builder keeps filters in each link. */
export function UrlPager({
  page,
  pageCount,
  href,
  label = "Pagination",
}: {
  page: number;
  pageCount: number;
  href: (page: number) => string;
  label?: string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label={label}
      className="mt-4 flex items-center justify-between gap-3 text-sm"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={LINK_CLASS}>
          Previous
        </Link>
      ) : (
        <span className={DISABLED_CLASS}>Previous</span>
      )}
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={LINK_CLASS}>
          Next
        </Link>
      ) : (
        <span className={DISABLED_CLASS}>Next</span>
      )}
    </nav>
  );
}
