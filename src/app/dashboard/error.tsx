"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ElevatedCard } from "@merqo/ui";
import { Wordmark } from "@/components/landing/wordmark";

/**
 * Error boundary for every /dashboard/* page — catches render/data errors
 * below `layout.tsx` (the header/nav itself keeps rendering, since error
 * boundaries never catch errors from their own segment's layout). Branded
 * to match login/page.tsx's ElevatedCard + Wordmark treatment rather than a
 * bare framework error page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary caught", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center p-5">
      <ElevatedCard className="w-full px-7 py-10 text-center">
        <Wordmark className="text-2xl" />
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Could not load this page. Try again, or go back to your dashboard.
        </p>
        <div className="mt-7 flex flex-col gap-2.5">
          <Button
            type="button"
            onClick={() => reset()}
            className="h-11 w-full rounded-lg"
          >
            Try again
          </Button>
          <Button asChild variant="outline" className="h-11 w-full rounded-lg">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </ElevatedCard>
    </div>
  );
}
