import { StatTileSkeleton } from "@merqo/ui";
import { Skeleton } from "@merqo/ui/primitives";

/**
 * Route-segment loading fallback for every /admin/* page. The gated layout
 * (header and nav) resolves outside this boundary. Each admin page renders
 * its own `<main>`, so the skeleton keeps that landmark; the shared tile
 * skeletons carry the busy status.
 */
export default function AdminLoading() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>
    </main>
  );
}
