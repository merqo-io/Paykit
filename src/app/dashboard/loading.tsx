import { ListSkeleton, StatTileSkeleton } from "@merqo/ui";
import { Skeleton } from "@merqo/ui/primitives";

/**
 * Route-segment loading fallback for every /dashboard/* page. `layout.tsx`
 * (header, rail, tab bar) resolves outside this Suspense boundary, so this
 * only stands in for the content inside `<main>`. It mirrors a list page's
 * real shape (title, two stat cards, five rows) at the same `max-w-5xl`
 * width as `PageShell`, so the page does not jump when content arrives.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-7 space-y-2" aria-hidden="true">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>
      <ListSkeleton rows={5} className="mt-6" />
    </div>
  );
}
