import { Skeleton } from "@merqo/ui/primitives";

/**
 * Route-segment loading fallback for every /dashboard/* page. `layout.tsx`
 * itself (the header/nav) resolves outside this Suspense boundary, so this
 * only stands in for the page content inside `<main>`, shaped like the home
 * hub: a page header, then a row of cards.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="mb-7 space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  );
}
