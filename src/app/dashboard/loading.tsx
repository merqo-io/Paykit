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
    <div
      className="mx-auto w-full max-w-5xl animate-pulse motion-reduce:animate-none"
      aria-hidden="true"
    >
      <div className="mb-7 space-y-2">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
