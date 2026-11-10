import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-segment loading fallback for every /admin/* page. The gated layout
 * (header and nav) resolves outside this boundary. Each admin page renders
 * its own `<main>`, so the skeleton keeps that landmark and puts the busy
 * status on an inner element.
 */
export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div role="status" aria-busy="true">
        <span className="sr-only">Loading</span>
        <div
          className="animate-pulse space-y-8 motion-reduce:animate-none"
          aria-hidden="true"
        >
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-72" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
