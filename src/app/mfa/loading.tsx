import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading fallback for /mfa, shaped like the centred sign-in card. The page
 * renders its own `<main>`, so the skeleton keeps that landmark and puts the
 * busy status on an inner element.
 */
export default function MfaLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div
        role="status"
        aria-busy="true"
        className="w-full max-w-md rounded-2xl border border-b-2 bg-card px-7 py-10"
      >
        <span className="sr-only">Loading</span>
        <div
          className="animate-pulse space-y-4 motion-reduce:animate-none"
          aria-hidden="true"
        >
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </main>
  );
}
